const mongoose = require('mongoose');

const CampSchema = new mongoose.Schema({
    title: { type: String, required: true },
    emplacement: { type: String, required: true },
    date: { type: Date, required: true },
    duration: { type: String, required: true },
    groupSize: { type: Number, required: true },
    ages: { type: String, required: true },
    googleMapUrl: { type: String, required: true },
    locationMaterials: { type: String, required: true },
    description: { type: String, required: true },
    highlights: { type: String, required: true },
    campgrpEmail: { type: String, required: true },
    campPictureCover: { type: String, required: true },
    prix: { type: Number, required: true },
    inclusion: { type: String, required: true },
    status: { type: String, required: false },
    reviewScore: { type: Number, required: false }
});

const Camp = mongoose.model('Camp', CampSchema);

module.exports = Camp;
