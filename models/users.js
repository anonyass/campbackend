const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String, required: true },
    governorate: { type: String, required: true },
    password: { type: String, required: true },
    temporaryPassword: { type: String },
    temporaryPasswordExpires: { type: Date }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
