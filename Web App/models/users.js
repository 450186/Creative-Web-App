const mongoose = require("mongoose");

const {Schema, model} = mongoose;

const PlacesVisitedSchema = new Schema({
    city: {type: String, required: true},
    country: {type: String, required: true},
    dateVisited: {
        startDate: { type: String, required: true },
        endDate: { type: String, required: true }
    },
    longitude: {type: String, required: true},
    latitude: {type: String, required: true},
    countryCode: {type: String, required: true},
    photos: {type: String},
    notes: {type: String},
    rating: {type: Number, min: 1, max: 5},
})

const userSchema = new Schema({
    username: String,
    password: String,
    PlacesVisited: [PlacesVisitedSchema],
})

const userData = model("user", userSchema);

async function addUser(username, password) {
    let userExists = null;

    userExists = await userData.findOne({username: username}).exec();

    if(userExists) {
        console.log("User already exists");
        return false;
    } else {
        let newUser = new userData({
            username: username,
            password: password,
        });    
            await userData.create(newUser)
            .catch((err) => {console.log("Error adding user: " + err);});
            return true;
    }
}

async function checkUser(username, password) {
    let userExists = null;

    userExists = await userData.findOne({username: username}).exec();

    if(userExists) {
        return userExists.password === password
    } else {
        return false;
    }
}
module.exports = {
    addUser,
    checkUser,
    userData
}