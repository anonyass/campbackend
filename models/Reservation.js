const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    reservationId: { type: String, required: true, unique: true },
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    campName: { type: String, required: true },
    date: { type: Date, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    reservationDate: { type: Date, default: Date.now },
    totalPrice: { type: Number, required: true },
    selectedExtras: { type: Object, required: true },
    comments: { type: String },
});

module.exports = mongoose.model('Reservation', ReservationSchema);
