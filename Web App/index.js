const express = require("express")
const app = express()
const path = require("path")

const port = process.env.PORT || 3005

app.listen(port, () => {
    console.log(`Listening on ${port}`)
})

const userModel = require("./models/users.js")

const session = require("express-session");
const dayjs = require("dayjs")
const bcrypt = require("bcrypt")

const dotenv = require("dotenv").config();

//Originally stored photos in a folder - chatGPT helped me to store them using cloudinary
//this helped with hosting on Render
const cloudinary = require("cloudinary").v2
const {CloudinaryStorage} = require("multer-storage-cloudinary")

cloudinary.config({
    cloud_name: process.env.CloudName,
    api_key: process.env.CloudAPIkey,
    api_secret: process.env.CloudSecret
})

const fiveMin = 5 * 60 * 1000;
const halfHour = 30 * 60 * 1000;
const OneHour = 1 * 60 * 60 * 1000;

const mongoDBusername = process.env.mongoDBusername;
const mongoDBpassword = process.env.mongoDBpassword;
const mongoAppName = process.env.mongoAppName;
const GeoAPIKey = process.env.GeoAPIKey;
const sessionSecret = process.env.sessionSecret


app.use(session({
    secret: sessionSecret,
    saveUninitialized: true,
    cookie: { 
        maxAge: fiveMin,
        secure: false
    },
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoDBusername}:${mongoDBpassword}@web-app-cluster.krmiigl.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require("mongoose");
const { title } = require("process")

mongoose.connect(connectionString)
.catch((err) => {
    console.log("MongoDB connection error: " + err);
});

app.set('view engine', 'ejs')

app.use(express.static(path.join(__dirname, 'public')));

const multer = require("multer")

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "globejumper/locations",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
            {
                width: 1200, 
                height: 1200, 
                crop: "limit",
                quality: "auto",
                fetch_format: "auto"
            }
        ]
    }
})

const upload = multer({
    storage,
    limits: {fileSize: 15 * 1024 * 1024}
})

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function checkLogin(req, res, next) {
    if(req.session && req.session.username) {
            next();
        } else {
            req.session.destroy();
            res.redirect("/landing");
        }
    }
function checkLoggedin(request) {
    return request.session && request.session.username
}

function format(d) {
    return dayjs(d).format("dddd, DD MMM YYYY")
}

async function findThingsToDo(latitude, longitude) {
    // https://apidocs.geoapify.com/docs/places/#api
    const geoURL = `https://api.geoapify.com/v2/places?categories=tourism.sights,entertainment.museum&filter=rect:${Number(longitude)-0.2},${Number(latitude)-0.2},${Number(longitude)+0.2},${Number(latitude)+0.2}&limit=8&apiKey=${GeoAPIKey}&lang=en`

    console.log("GEO URL:", geoURL)
    let thingsToDo = []

    try {
        const geoRes = await fetch(geoURL)
        const geoData = await geoRes.json()
        console.log("GEO DATA:", geoData)
        if(geoData.features && geoData.features.length > 0) {

            thingsToDo = geoData.features.map(feature => {

    //Chat GPT helped me with making the categories readable. my solution didnt fully work
//Below is the prompt I put into chatGPT

//I attempted to make the categories in my location page user readable, my thought process was to split the categories by "." using .split and then getting just what comes after the "."s
// here is my code:
// async function findThingsToDo(latitude, longitude) {
//     const geoURL = `https://api.geoapify.com/v2/places?categories=tourism.sights,entertainment.museum&filter=rect:${Number(longitude)-0.2},${Number(latitude)-0.2},${Number(longitude)+0.2},${Number(latitude)+0.2}&limit=8&apiKey=${GeoAPIKey}&lang=en`

//     console.log("GEO URL:", geoURL)
//     let thingsToDo = []

//     try {
//         const geoRes = await fetch(geoURL)
//         const geoData = await geoRes.json()
//         console.log("GEO DATA:", geoData)
//         if(geoData.features && geoData.features.length > 0) {
//             const categories = feature.properties.categories
//                         ? feature.properties.categories.join("\n")
//                         : feature.properties.category || ""
//             const splitCats = categories.split(".")
//             splitCats.filter((element, index) => {return index % 2 === 0})
//             thingsToDo = geoData.features.map(feature => {
//                 return {
//                     name: feature.properties.name,
//                     address: feature.properties.formatted,
//                     category: splitCats,
//                     latitude: feature.properties.lat,
//                     longitude: feature.properties.lon,
//                     distance: feature.properties.distance,
//                 }
//             })
//         }
//     } catch (e) {
//         console.error("Error fetching GeoAPI data:", e)
//     }
//     return thingsToDo
// }

                const categories = feature.properties.categories || []
                const readable = categories.map(cat => {
                    //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/split
                    const parts = cat.split(".")
                    let last = parts[parts.length - 1]
                    last = last.replace(/_/g, " ")

                    if(last === "yes") return "Accessible"
                    if(last === "no") return "Not Accessible"

                    return last.charAt(0).toUpperCase() + last.slice(1);
                })    
                return {
                    name: feature.properties.name,
                    address: feature.properties.formatted,
                    category: readable.join("\n"),
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
    res.render('pages/landing', {
        title: "Welcome!"
    })
})
app.get("/landing", (req, res) => {
    res.render('pages/landing', {
        title: "Welcome!"
    })
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
        wishList: locationData.wishList ?? [],
        errorMessage: req.session.errorMessage
    })
    req.session.errorMessage = null
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
            return res.redirect("/landing")
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
    if (!User) return res.redirect("/landing");
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
    const sort = req.query.sort || "date-desc"

    const convertTime = (date) => date ? new Date(date).getTime() : 0;

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

    switch (sort) {
        case "date-asc":
            formatLocation.sort((a, b) => convertTime(a.dateVisited.startDate) - convertTime(b.dateVisited.startDate));
            break;
        case "date-desc":
            formatLocation.sort((a, b) => convertTime(b.dateVisited.startDate) - convertTime(a.dateVisited.startDate));
            break;
        case "rating-asc":
            formatLocation.sort((a, b) => a.rating - b.rating);
            break;
        case "rating-desc":
            formatLocation.sort((a, b) => b.rating - a.rating);
            break;
        case "city-asc":
            formatLocation.sort((a, b) => a.city.localeCompare(b.city));
            break;
        case "city-desc":
            formatLocation.sort((a, b) => b.city.localeCompare(a.city));
            break;
        default:
            // Default to date-desc if sort parameter is unrecognized
            formatLocation.sort((a, b) => convertTime(b.dateVisited.startDate) - convertTime(a.dateVisited.startDate));
            break;
    }

    req.session.sortPref = sort

    console.log(allLocations.PlacesVisited)
    res.render('pages/history', {
        username: username,
        Loggedin: checkLoggedin(req),
        title: "History",
        locations: formatLocation,
        sort,
        sortPreference: req.session.sortPref
    })
})

app.get("/api/things-to-do", async (req, res) => {
    const {latitude, longitude} = req.query
    try {
    const thingsToDo = await findThingsToDo(Number(latitude), Number(longitude))
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

    const NomURL = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1&accept-language=en`;

    try {    
    //chatGPT helped me with this part to make the calls parallel and work quicker using promise.all
    const [User, nominatimRes] = await Promise.all([
        userModel.userData.findOne({username}),
        fetch(NomURL, {
            headers: {"User-Agent" : "GlobeJumper/1.0 (contact: jack.simcox23@bathspa.ac.uk)"}
        })
    ])

    if(!nominatimRes.ok) {
        const body = await nominatimRes.text()
        console.error("Nominatim API error:", nominatimRes.status, body.slice(0, 200))
        return res.status(500).send("Location lookup failed. Check server logs.");
    }
    
    if(!User) {
        console.error("User not found!")
        return res.redirect("/landing")
    }

    const nominatimData = await nominatimRes.json()
    const data = nominatimData

    const Place =
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.municipality ||
        data.address?.locality ||
        data.address?.hamlet ||
        data.address?.suburb ||
        data.address?.county ||
        data.address?.state ||
        data.address?.region;

    const Country = data.address?.country
    const State = data.address?.state || null;

    if (!Country) {
        req.session.errorMessage = "Your dart landed somewhere with no nearby city info — try again!";
        return res.redirect("/home");
    } 

    const countryCode = data.address?.country_code 
    ? data.address.country_code.toUpperCase()
    : null;

    let cityOutput = Place;

    if(countryCode === "US" && State && Place) {
        cityOutput = `${Place}, ${State}`;
    }

    const inWishlist = User.wishList.some(location => location.city === Place && location.country === Country);

    const locationVisited = User.PlacesVisited.find(location => location.city === Place && location.country === Country)
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
            latitude: Number(latitude),
            longitude: Number(longitude),
            city: cityOutput || "",
            country: Country,
            countryCode: countryCode,
            wishList: User.wishList || [],
            inWishlist: inWishlist,
            locationFound,
            visitedData,
        });  

} catch (e) {
    // console.error("Error fetching API data: ", e)
    // res.redirect('/home')
    console.error("Error fetching API data: ", e);
    return res.status(500).send("Location lookup failed. Check server logs.");
    }
})

app.post("/location/upload", checkLogin, async (req, res) => {
    upload.array("photos", 3)(req, res, async (err) => {
    const username = req.session.username;

        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                req.session.errorMessage = "The limit of file size is 20MB";
            } else {
                req.session.errorMessage = "Image upload failed.";
            }
            return res.redirect(`/location?latitude=${req.body.latitude}&longitude=${req.body.longitude}`);
        }

        try {
            const username = req.session.username
            const latitude = Number(req.body.latitude)
            const longitude = Number(req.body.longitude)
            if(!req.files || req.files.length === 0) {
                req.session.errorMessage = "Please Select at least one image"
                return res.redirect(`/location?latitude=${latitude}&longitude=${longitude}`)
            }

            const images = req.files.map(file => file.path )
            console.log(req.files)
            

            const result = await userModel.userData.updateOne(
                {
                    username: username,
                    "PlacesVisited.latitude": latitude,
                    "PlacesVisited.longitude": longitude
                },
                {
                    $push: {
                        "PlacesVisited.$.photos": {$each: images}
                    }
                }
            );
            res.redirect(`/location?latitude=${latitude}&longitude=${longitude}`)
        }catch(e) {
            console.log("Upload error: ", e)
            req.session.errorMessage = "Could not upload photos";
            res.redirect(`/location?latitude=${req.body.latitude}&longitude=${req.body.longitude}`)
        }
    });
})

app.get("/search-location", checkLogin, async (req, res) => {
    const query = req.query.query

    if(!query) return res.redirect("/home");

    const searchUrl = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}` +
        `&format=json&limit=1&addressdetails=1`;

    try {
        const response = await fetch(searchUrl, {
            headers: {"User-Agent": "GlobeJumper/1.0 (contact: jack.simcox23@bathspa.ac.uk)"}
        })

        const searchRes = await response.json()

        if(!searchRes || searchRes.length === 0) {
            req.session.errorMessage = "Could Not find that City"
            return res.redirect("/home")
        }
        const {lat, lon} = searchRes[0]

        res.redirect(`/location?latitude=${lat}&longitude=${lon}`);
    } catch (e) {
        console.log("Search error: ", e)
        res.redirect("/home")
    }

})

app.post("/add-location", checkLogin, (req, res) => {
    //chatGPT assistance on how to get error messages for multer
    upload.array("photos", 3)(req, res, async (err) => {
        const username = req.session.username;

    if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
            req.session.errorMessage = "The limit of file size is 20MB";
        } else {
            req.session.errorMessage = "Image upload failed.";
        }
        return res.redirect(`/location?latitude=${req.body.latitude}&longitude=${req.body.longitude}`);
    }


        try {
            const User = await userModel.userData.findOne({ username });

            if (!User) {
                console.error("User not found!");
                return res.redirect("/landing");
            }

            const {
                city,
                country,
                visitDateStart,
                visitDateEnd,
                longitude,
                latitude,
                countryCode,
                notes,
                rating,
            } = req.body;

            const lat = Number(latitude);
            const lng = Number(longitude);

            const images = req.files
                ? req.files.map(f => f.path)
                : [];
            console.log(req.files)
            const newLoc = {
                city,
                country,
                dateVisited: {
                    startDate: visitDateStart,
                    endDate: visitDateEnd,
                },
                longitude: lng,
                latitude: lat,
                countryCode,
                photos: images,
                notes,
                rating: Number(rating),
            };

            await userModel.userData.findOneAndUpdate(
                {username},
                {
                    $push: {PlacesVisited: newLoc},
                    $pull: {wishList: {city, country}},
                }
            )

            res.redirect("/history");
        } catch (e) {
            console.error("Error saving user:", e);

            let inWishlist = false;
            let locationFound = false;

            if (User) {
                inWishlist = User.wishList.some(
                    loc => loc.city === req.body.city && loc.country === req.body.country
                );
                locationFound = User.PlacesVisited.some(
                    loc => loc.city === req.body.city && loc.country === req.body.country
                );
            }

            req.session.errorMessage = "Could not save Location";

            res.render("pages/location", {
                errorMessage: req.session.errorMessage,
                username,
                Loggedin: checkLoggedin(req),
                title: req.body.country,
                latitude: req.body.latitude,
                longitude: req.body.longitude,
                city: req.body.city || "",
                country: req.body.country,
                countryCode: req.body.countryCode,
                inWishlist,
                locationFound,
            });
        }
    });
});

app.post("/delete-location", checkLogin, async (req, res) => {
    username = req.session.username
    const {city, country} = req.body

    const User = await userModel.userData.findOne({username: username})
    
    await userModel.userData.findOneAndUpdate(
        {username: username},
        {$pull: {PlacesVisited: {city: city, country: country}}}
    )

    res.redirect("/home")
})

app.get("/suggestions", (req, res) => {
    res.render('pages/suggestions', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Suggestions",
    })
})

app.get("/account", checkLogin, async (req, res) => {

    const User = await userModel.userData.findOne({username: req.session.username})

    passwordlength = User.password.length

    res.render('pages/account', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Profile",
        firstName: User.firstName,
        lastName: User.lastName,
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
    const {username, password} = req.body

    const user = await userModel.userData.findOne({username})

    if(!user) {
        return res.render('pages/login', {
            title: "Login",
            errorMessage: req.session.errorMessage = "This user does not exist!",
        })
    }
    const isValid = await bcrypt.compare(password, user.password)

    if(!isValid) {
        req.session.errorMessage = "Incorrect password, please try again!"
        return res.render('pages/login', {
            title: "Login",
            errorMessage: req.session.errorMessage,
        })
    }

    req.session.username = req.body.username
    res.redirect("/home")
});

app.get("/register", (req, res) => {
    res.render('pages/register', {
        title: "Register"
    })
})

app.post("/register", async (req, res) => {
    const {username, password, firstName, lastName} = req.body
    const hashed = await bcrypt.hash(password, 10)

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
    if(!passwordRegex.test(password)) {
        req.session.errorMessage = "Password must match the rules. press the information icon to check the rules"
        return res.render('pages/register', {
            errorMessage: req.session.errorMessage
        })
    }

    if(await userModel.addUser(username, hashed, firstName, lastName)) {
        req.session.username = req.body.username
        res.redirect("/home")
    } else {
        req.session.errorMessage ="Username is already in use!"
        res.render('pages/login', {
            errorMessage: req.session.errorMessage,
            title: "Login",
        })
    }
});
app.post('/edit-username', checkLogin ,async (request, response) => {
    let oldUsername = request.session.username
    const {newUsername} = request.body
    if(newUsername === oldUsername) {
        return response.json({success: true, message: "Username was not changed!"})
    } else if(await userModel.checkUsername(newUsername)) {
        return response.json({ success: false, error: "Username already exists" });
    }
    await userModel.userData.findOneAndUpdate(
        {username: oldUsername},
        {username: newUsername},
        {new: true}
    );

    request.session.username = newUsername;

    return response.json({ success: true });
})

app.post('/edit-firstname', async (request, response) => {
    let CurrentUsername = request.session.username
    const {newFirstname} = request.body

    
    await userModel.userData.findOneAndUpdate(
        {username: CurrentUsername},
        {firstName: newFirstname},
        {new: true}
    );

    return response.json({ success: true });

})
app.post('/edit-lastname', async (request, response) => {
    let CurrentUsername = request.session.username
    const {newLastname} = request.body

    
    await userModel.userData.findOneAndUpdate(
        {username: CurrentUsername},
        {lastName: newLastname},
        {new: true}
    );

    return response.json({ success: true });

})

app.get('/user-deleted', (req, res) => {
    res.render('pages/userDeleted', {
        title: "Goodbye"
    })
})

app.post('/delete-user', checkLogin, async (req, res) => {
    let User = await userModel.userData.findOne({username: req.body.username})

    await userModel.deleteUser(User.username)
    res.redirect('/user-deleted')
})

app.get('/where-to', checkLogin, async (req, res) => {
    const username = req.session.username
    const user = await userModel.userData.findOne({username: username}, {preferences: 1})

    res.render('pages/whereTo', {
        username: username,
        Loggedin: checkLoggedin(req),
        title: "Where To?",
        preferences: user?.preferences || {}
    })
})

app.get("/logout", checkLogin, (req, res) => {
    req.session.destroy();
    res.redirect("/landing")
});