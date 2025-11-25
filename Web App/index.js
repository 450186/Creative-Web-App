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

const dotenv = require("dotenv").config();


const threeMin = 3 * 60 * 1000;

const mongoDBusername = process.env.mongoDBusername;
const mongoDBpassword = process.env.mongoDBpassword;
const mongoAppName = process.env.mongoAppName;

app.use(session({
    secret: "SecretKeyForSession",
    saveUninitialized: true,
    cookie: { maxAge: threeMin },
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoDBusername}:${mongoDBpassword}@web-app-cluster.krmiigl.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require("mongoose");

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

app.get("/", checkLogin, (req, res) => {
    res.redirect("/login")
})

app.get("/home", checkLogin, (req, res) => {
    res.render('pages/home', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Home",
    })
})

app.get("/wishlist", checkLogin, (req, res) => {
    res.render('pages/wishlist', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "Wishlist"
    })
})

app.get("/history", checkLogin, (req, res) => {
    res.render('pages/history', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: "History",
    })
})

app.get("/location", checkLogin ,async (req, res) => {

    const {latitude, longitude} = req.query
// https://nominatim.org/release-docs/develop/api/Reverse/
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&addressdetails=1`

    const response = await fetch(url, {
        headers: {"User-Agent" : "TravelrApp"} //nominatim requires this to identify app and stop nominatim from blocking my app
    })
    const data = await response.json()
    const Country = data.address?.country
    const City = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality
    const countryCode = data.address.country_code
    // const codeGet = await fetch(
    //     `https://restcountries.com/v3.1/name/${Country}?fullText=true`
    // )

    // const codeData = await codeGet.json()
    // countryCode = codeData?.[0]?.cca2 || codeData?.[0]?.cca3

    res.render('pages/location', {
        username: req.session.username,
        Loggedin: checkLoggedin(req),
        title: Country,
        latitude: latitude,
        longitude: longitude,
        city: City,
        country: Country,
        countryCode: countryCode
    })
})

app.post("/add-location", checkLogin, async (req, res) => {

    try {
    console.log("FORM BODY:", req.body);

        const {
            city,
            country,
            countryCode,
            visitDateStart,
            visitDateEnd,
            notes,
            rating,
            photos
        } = req.body
        
        const newLoc = {
            city,
            country,
            dateVisited: {
                startDate: visitDateStart,
                endDate: visitDateEnd
            },
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
            latitude: "",
            longitude: "",
            city: req.body.city,
            country: req.body.country,
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
        res.sendFile(path.join(__dirname, "views", "failedLogin.html"))
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
        res.sendFile(path.join(__dirname, "views", "failedRegister.html"))
    }
});

app.get("/logout", checkLogin, (req, res) => {
    req.session.destroy();
    res.redirect("/login")
});