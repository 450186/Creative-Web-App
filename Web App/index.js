const express = require("express")
const app = express()
const path = require("path")

const port = 3005

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})

const userModel = require("./models/users.js")

const session = require("express-session");
const cookieParser = require("cookie-parser");
const dayjs = require("dayjs")

const dotenv = require("dotenv").config();


const fiveMin = 5 * 60 * 1000;

const mongoDBusername = process.env.mongoDBusername;
const mongoDBpassword = process.env.mongoDBpassword;
const mongoAppName = process.env.mongoAppName;

app.use(session({
    secret: "SecretKeyForSession",
    saveUninitialized: true,
    cookie: { maxAge: fiveMin},
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoDBusername}:${mongoDBpassword}@web-app-cluster.krmiigl.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require("mongoose");
const { title } = require("process")

mongoose.connect(connectionString)
.catch((err) => {
    console.log("MongoDB connection error: " + err);
});

app.use(express.static("public"));

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

app.get("/", checkLogin, (req, res) => {
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
        res.redirect('/home')
        successMessage = `${city} added to your wishlist!`

    } catch (e) {
        console.error("Could not add to Wishlist!")
        res.render('pages/home', {
            city,
            errorMessage: `Could not add ${city} to your wishlist!`,
            username: req.session.username,
            title: "Home",
            Loggedin: checkLoggedin(req)
        })
    }
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

app.get("/location", checkLogin ,async (req, res) => {

    const {latitude, longitude} = req.query
// https://nominatim.org/release-docs/develop/api/Reverse/
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1&accept-language=en`
    const username = req.session.username

    const User = await userModel.userData.findOne({username: username})
    if(!User) {
        console.error("User not found!")
        return res.redirect("/login")
    }
    const response = await fetch(url, {
        headers: {"User-Agent" : "TravelrApp"} //nominatim requires this to identify app and stop nominatim from blocking my app
    })
    const data = await response.json()
    // if(!data.address?.country  || !data.address?.city) {
    //     console.error("Could not get location data from Nominatim")
    //     return res.render("pages/home", {
    //         errorMessage: "Could not get location data for the selected location. Please try again.",
    //         username: req.session.username,
    //         Loggedin: checkLoggedin(req),
    //         title: "Home",
    //         locations: User.PlacesVisited || [],
    //         wishList: User.wishList || []
    //     })    
    // } else {
        const City = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality
        const Country = data.address?.country
        const countryCode = data.address.country_code.toUpperCase()
        if (!User) {
            console.error("User not found!");
            return res.redirect("/login");
        }

        res.render('pages/location', {
            username: req.session.username,
            Loggedin: checkLoggedin(req),
            title: Country,
            latitude: latitude,
            longitude: longitude,
            city: City,
            country: Country,
            countryCode: countryCode,
            wishList: User.wishList || []
        })

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

        res.redirect('/history')
    } catch (e) {
            console.error("Error saving user:", e);
        res.render('pages/location', {
            errorMessage: "Could not save Location",
            username: req.session.username,
            Loggedin: checkLoggedin(req),
            title: req.body.country,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            city: req.body.city,
            country: req.body.country,
            countryCode: req.body.countryCode
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
            errorMessage: "Username or Password Incorrect!"
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
            errorMessage: "Username is already in use!",
            title: "Home",
        })
    }
});

app.get("/logout", checkLogin, (req, res) => {
    req.session.destroy();
    res.redirect("/login")
});