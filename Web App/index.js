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


const oneMin = 60 * 1000;

const mongoDBusername = process.env.mongoDBusername;
const mongoDBpassword = process.env.mongoDBpassword;
const mongoAppName = process.env.mongoAppName;

app.use(session({
    secret: "SecretKeyForSession",
    saveUninitialized: true,
    cookie: { maxAge: oneMin },
    resave: false,
}))

const connectionString = `mongodb+srv://${mongoDBusername}:${mongoDBpassword}@web-app-cluster.krmiigl.mongodb.net/${mongoAppName}?retryWrites=true&w=majority`;
const mongoose = require("mongoose");

mongoose.connect(connectionString)
.catch((err) => {
    console.log("MongoDB connection error: " + err);
});

app.use(express.static("public"));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function checkLogin(req, res, next) {
    if(req.session) {
        if(req.session.user) {
            next();
        } else {
            req.session.destroy();
            res.redirect("/login");
        }
    }
}

app.get("/", checkLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login.html"))
})

app.get("/wishlist", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "Wishlist.html"))
})

app.get("/history", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "History.html"))
})

app.get("/location", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "Location.html"))
})

app.get("/settings", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "Settings.html"))
})

app.get("/account", checkLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "views", "Account.html"))
})
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login.html"))
})
app.post("/login", async (req, res) => {
    if(await userModel.checkUser(req.body.username, req.body.password)) {
        req.session.user = req.body.username;
        res.sendFile(path.join(__dirname, "views", "Home.html"))
    } else {
        res.sendFile(path.join(__dirname, "views", "failedLogin.html"))
    }
});

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "Register.html"))
})

app.post("/register", async (req, res) => {
    if(await userModel.addUser(req.body.username, req.body.password)) {
        res.sendFile(path.join(__dirname, "views", "Home.html"))
    } else {
        res.sendFile(path.join(__dirname, "views", "failedRegister.html"))
    }
});

app.get("/logout", checkLogin, (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});