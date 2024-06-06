const mongoose = require('mongoose');

const CampCommentSchema = new mongoose.Schema({
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    camperEmail: { type: String, required: true },
    camperFullName: { type: String, required: true }, // New field for camper's full name
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CampComment', CampCommentSchema);
