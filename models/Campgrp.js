const mongoose = require('mongoose');

const CampgrpSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String, required: true },
    governorate: { type: String, required: true },
    password: { type: String, required: true },
    chefName: { type: String, required: true },
    picture: { type: String, required: true },
    creationDate: { type: String, required: true },
    socialMediaLink: { type: String },
    comments: { type: String },
});

module.exports = mongoose.model('Campgrp', CampgrpSchema);
