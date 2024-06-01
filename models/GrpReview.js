const mongoose = require('mongoose');

const GrpReviewSchema = new mongoose.Schema({
    campGrpEmail: { type: String, required: true },
    camperEmail: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 5 },
}, { timestamps: true });

const GrpReview = mongoose.model('GrpReview', GrpReviewSchema);

module.exports = GrpReview;
