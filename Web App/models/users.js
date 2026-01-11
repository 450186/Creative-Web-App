const e = require("express");
const mongoose = require("mongoose");

const {Schema, model} = mongoose;

const PreferencesSchema = new Schema({
    holidayTypes: {type: [String], default: []},
    budget: {type: Number, default: 2, min: 1, max: 5},
    climates: {type: [String], default: []},
    pace: {type: String, default: 'balanced'},
    updatedAt: {type: Date, default: Date.now}
})
const PlacesVisitedSchema = new Schema({
    city: {type: String, required: true},
    country: {type: String, required: true},
    dateVisited: {
        startDate: { type: String, required: true },
        endDate: { type: String, required: true }
    },
    longitude: {type: Number, required: true},
    latitude: {type: Number, required: true},
    countryCode: {type: String, default: ''},
    photos: [{type: String}],
    notes: {type: String},
    rating: {type: Number, min: 1, max: 5},
})
const WishListSchema = new Schema({
    city: {type: String, required: true},
    country: {type: String, required: true},
    longitude: {type: Number, required: true},
    latitude: {type: Number, required: true},
    countryCode: {type: String, required: true},
})

const userSchema = new Schema({
    username: String,
    password: String,
    firstName: String,
    lastName: String,
    PlacesVisited: {type:[PlacesVisitedSchema], default: []},
    wishList: {type:[WishListSchema], default: []},
    preferences: {type: PreferencesSchema, default: {}},
})

const userData = model("user", userSchema);

async function addUser(username, password, firstName, lastName) {
  const userExists = await userData.findOne({ username }).exec();
  if (userExists) return false;

  try {
    await userData.create({
      username,
      password,
      firstName,
      lastName,
      PlacesVisited: [],
      wishList: [],
      preferences: {},
    });
    return true;
  } catch (err) {
    console.log("Error adding user:", err);
    return false; 
  }
}


async function deleteUser(username) {
    return await userData.deleteOne({username: username}).exec()
}

async function checkUsername(username) {
    let userExists = null;

    userExists = await userData.findOne({username: username}).exec();

    if(userExists) {
        return true;
    } else {
        return false;
    }
}
module.exports = {
    addUser,
    checkUsername,
    deleteUser,
    userData
}