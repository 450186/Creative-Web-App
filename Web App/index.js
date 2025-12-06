const express = require("express")
const app = express()
const path = require("path")

const port = 3005

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})

const userModel = require("./models/users.js")

const session = require("express-session");
const dayjs = require("dayjs")

const dotenv = require("dotenv").config();


const fiveMin = 5 * 60 * 1000;

const mongoDBusername = process.env.mongoDBusername;
const mongoDBpassword = process.env.mongoDBpassword;
const mongoAppName = process.env.mongoAppName;
const GeoAPIKey = process.env.GeoAPIKey;

app.use(session({
    secret: "SecretKeyForSession",
    saveUninitialized: true,
    cookie: { maxAge: fiveMin},
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoDBusername}:${mongoDBpassword}@web-app-cluster.krmiigl.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require("mongoose");

mongoose.connect(connectionString)
.catch((err) => {
    console.log("MongoDB connection error: " + err);
});

app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function checkLogin(req, res, next) {
    if(req.session && req.session.username) {
            next();
        } else {
            req.session.destroy();
            res.redirect("/login");
        }
    }
function checkLoggedin(request) {
    return request.session && request.session.username
}

function format(d) {
    return dayjs(d).format("dddd, DD MMM YYYY")
}

async function findThingsToDo(latitude, longitude) {
    const geoURL = `https://api.geoapify.com/v2/places?categories=tourism.sights,entertainment.museum&filter=rect:${Number(longitude)-0.2},${Number(latitude)-0.2},${Number(longitude)+0.2},${Number(latitude)+0.2}&limit=8&apiKey=${GeoAPIKey}&lang=en`

    console.log("GEO URL:", geoURL)
    let thingsToDo = []

    try {
        const geoRes = await fetch(geoURL)
        const geoData = await geoRes.json()
        console.log("GEO DATA:", geoData)
        if(geoData.features && geoData.features.length > 0) {
            thingsToDo = geoData.features.map(feature => {
                return {
                    name: feature.properties.name,
                    address: feature.properties.formatted,
                    category: feature.properties.categories
                        ? feature.properties.categories.join("\n")
                        : feature.properties.category || "",
                    latitude: feature.properties.lat,
                    longitude: feature.properties.lon,
                    distance: feature.properties.distance,
                }
            })
        }
    } catch (e) {
        console.error("Error fetching GeoAPI data:", e)
    }
    return thingsToDo
}

app.get("/", (req, res) => {
    res.redirect("/login")
})

app.get("/home", checkLogin, async (req, res) => {

    let username = req.session.username

    let locationData = await userModel.userData.findOne({username: username}, {
        _id: 0,
        password: 0,
        __v: 0
    })

    res.render('pages/home', {
        username: username,
        Loggedin: checkLoggedin(req),
        title: "Home",
        locations: locationData.PlacesVisited ?? [],
        wishList: locationData.wishList ?? []
    })
})

app.get("/wishlist", checkLogin, async (req, res) => {
    username = req.session.username

    const User = await userModel.userData.findOne({username: username}, {
        _id: 0,
        password: 0,
        __v: 0
    })

    res.render('pages/wishlist', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Wishlist",
        wishList: User.wishList ?? []
    })
})

app.post("/add-wishlist", checkLogin, async (req, res) => {
    try{
        const {
            city,
            country,
            longitude,
            latitude,
            countryCode,
        } = req.body

        const lat = Number(latitude)
        const lng = Number(longitude)

        const newWishlist = {
            city,
            country,
            longitude: lng,
            latitude: lat,
            countryCode
        }
        const User = await userModel.userData.findOne({username: req.session.username})
        if(!User) {
            console.error("User not found!")
            return res.redirect("/login")
        }
        User.wishList.push(newWishlist)
        await User.save()

        req.session.successMessage = `${city} added to your wishlist!`

        res.redirect('/home')

    } catch (e) {
        console.error("Could not add to Wishlist!")
        res.render('pages/home', {
            city,
            errorMessage: req.session.errorMessage = "Could not add to Wishlist!",
            username: req.session.username,
            title: "Home",
            Loggedin: checkLoggedin(req)
        })
    }
})

app.post("/remove-wishlist", checkLogin, async (req, res) => {
    username = req.session.username
    const {city, country} = req.body
    const User = await userModel.userData.findOne({username: username})

    await userModel.userData.updateOne(
        {username: username},
        {$pull: {wishList: {city: city, country: country}}}
    )
    if (!User) return res.redirect("/login");
    const locationVisited = User.PlacesVisited.find(location => location.city === city && location.country === country)
    const locationFound = !!locationVisited;

    let visitedData = null; 
    if(locationFound) {
        visitedData = {
            ...locationVisited.toObject(),
            formattedStart: format(locationVisited.dateVisited.startDate),
            formattedEnd: format(locationVisited.dateVisited.endDate)
        }
    }

    res.redirect('/home')

})

app.get("/history", checkLogin, async (req, res) => {
    let username = req.session.username

    let allLocations = await userModel.userData.findOne({username: username}, {
        _id: 0,
        password: 0,
        __v: 0
    })

    const formatLocation = allLocations.PlacesVisited.map(loc => ({
        ...loc.toObject(),//stop from making brand new object, keep previous data and add new fields
        formattedStart: format(loc.dateVisited.startDate),
        formattedEnd: format(loc.dateVisited.endDate)
    }))


    console.log(allLocations.PlacesVisited)
    res.render('pages/history', {
        username: username,
        Loggedin: checkLoggedin(req),
        title: "History",
        locations: formatLocation,
    })
})

app.get("/api/things-to-do", async (req, res) => {
    const {latitude, longitude} = req.query
    try {
    const thingsToDo = await findThingsToDo(latitude, longitude)
    res.json({thingsToDo})
    } catch (e) {
        console.error(e)
        res.status(500).json({error: "Could not fetch things to do"})
    }
})

app.get("/location", checkLogin ,async (req, res) => {

    const {latitude, longitude} = req.query
    // https://nominatim.org/release-docs/develop/api/Reverse/
    const username = req.session.username

    const geoURL = `https://api.geoapify.com/v2/places?category=tourism.sights,entertainment.museum&filter=rect:${Number(longitude)-0.2},${Number(latitude)-0.2},${Number(longitude)+0.2},${Number(latitude)+0.2}&limit=5&apiKey=${GeoAPIKey}&lang=en`;
    const NomURL = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1&accept-language=en`;

    try {    
    //chatGPT helped me with this part to make the calls parallel and work quicker using promise.all
    const [User, nominatimRes] = await Promise.all([
        userModel.userData.findOne({username}),
        fetch(NomURL, {
            headers: {"User-Agent" : "TravelrApp"}
        })
    ])
    
    if(!User) {
        console.error("User not found!")
        return res.redirect("/login")
    }

    const nominatimData = await nominatimRes.json()
    const data = nominatimData

    const City = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.county
    const Country = data.address?.country

    const countryCode = data.address?.country_code 
    ? data.address.country_code.toUpperCase()
    : null;

    const inWishlist = User.wishList.some(location => location.city === City && location.country === Country);

    const locationVisited = User.PlacesVisited.find(location => location.city === City && location.country === Country)
    const locationFound = !!locationVisited;

        let visitedData = null;
        if(locationFound) {
            visitedData = {
                ...locationVisited.toObject(),
                formattedStart: format(locationVisited.dateVisited.startDate),
                formattedEnd: format(locationVisited.dateVisited.endDate)
            };
        }

        res.render('pages/location', {
            username: req.session.username,
            Loggedin: checkLoggedin(req),
            title: Country,
            latitude: latitude,
            longitude: longitude,
            city: City || "",
            country: Country,
            countryCode: countryCode,
            wishList: User.wishList || [],
            inWishlist: inWishlist,
            locationFound,
            visitedData,
        });  

} catch (e) {
    console.error("Error fetching API data: ", e)
    res.redirect('/home')
    }
})

app.post("/add-location", checkLogin, async (req, res) => {

    try {
    console.log("FORM BODY:", req.body);

        const {
            city,
            country,
            visitDateStart,
            visitDateEnd,
            longitude,
            latitude,
            countryCode,
            photos,
            notes,
            rating,
        } = req.body
    //convert the latitude and longitude from strings in the mongoDB to numbers
    const lat = Number(latitude)
    const lng = Number(longitude)
        
        const newLoc = {
            city,
            country,
            dateVisited: {
                startDate: visitDateStart,
                endDate: visitDateEnd
            },
            longitude: lng,
            latitude: lat,
            countryCode,
            photos,
            notes,
            rating: Number(rating),
        }

        const User = await userModel.userData.findOne({username: req.session.username})
                if (!User) {
            console.error("User not found!");
            return res.redirect("/login");
        }
        User.PlacesVisited.push(newLoc)
        await User.save()
        inWishlist = User.wishList.some(location => location.city === city && location.country === country);

        res.redirect('/history')
    } catch (e) {

        let inWishlist = false;
        let locationFound = false;
        if (User) {
            inWishlist = User.wishList.some(loc => loc.city === city && loc.country === country);
            locationFound = User.PlacesVisited.some(loc => loc.city === city && loc.country === country);
        }
            console.error("Error saving user:", e);
        res.render('pages/location', {
            errorMessage: req.session.errorMessage ="Could not save Location",
            username: req.session.username,
            Loggedin: checkLoggedin(req),
            title: req.body.country,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            city: req.body.city || "",
            country: req.body.country,
            countryCode: req.body.countryCode,
            inWishlist: inWishlist,
            locationFound: locationFound,
        })
    }
})

app.get("/settings", (req, res) => {
    res.render('pages/settings', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Settings",
    })
})

app.get("/account", checkLogin, (req, res) => {
    res.render('pages/account', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Account",
    })
})
app.get("/login", (req, res) => {
    res.render('pages/login', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Login",
    })
})
app.post("/login", async (req, res) => {
    if(await userModel.checkUser(req.body.username, req.body.password)) {
        req.session.username = req.body.username;
        res.redirect("/home")
    } else {
        res.render('pages/login', {
            title: "Login",
            errorMessage: req.session.errorMessage ="Username or Password Incorrect!"
        })
    }
});

app.get("/register", (req, res) => {
    res.render('pages/register', {
        title: "Register"
    })
})

app.post("/register", async (req, res) => {
    if(await userModel.addUser(req.body.username, req.body.password)) {
        req.session.username = req.body.username
        res.redirect("/home")
    } else {
        res.render('pages/register', {
            errorMessage: req.session.errorMessage ="Username is already in use!",
            title: "Home",
        })
    }
});

app.get("/logout", checkLogin, (req, res) => {
    req.session.destroy();
    res.redirect("/login")
});