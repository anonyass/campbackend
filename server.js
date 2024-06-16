const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const User = require('./models/users');
const Campgrp = require('./models/Campgrp');
const Camp = require('./models/Camp'); // Import the Camp model
const Reservation = require('./models/Reservation');
const GrpReview = require('./models/GrpReview');
const CampComment = require('./models/CampComment');
const Blog = require('./models/Blog'); // adjust the path as necessary
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve static files from the uploads directory

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Connection error', error);
});

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup for file uploads to Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads',
        format: async (req, file) => 'jpg', // supports promises as well
        public_id: (req, file) => Date.now().toString() + '-' + file.originalname,
    },
});
const upload = multer({ storage: storage });

// Register endpoint for campers
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, telephone, governorate, password } = req.body;
        const newUser = new User({ fullName, email, telephone, governorate, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            res.status(400).json({ message: 'Email already exists' });
        } else {
            res.status(500).json({ message: 'Error registering user' });
        }
    }
});

// Login endpoint for campers
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Email does not exist' });
        }
        if (user.password !== password) { // For a more secure app, use hashed passwords with bcrypt
            return res.status(400).json({ message: 'Email or password is incorrect' });
        }
        res.status(200).json({ fullName: user.fullName, email: user.email, governorate: user.governorate, telephone: user.telephone });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in' });
    }
});

// User info endpoint
app.get('/userinfo', async (req, res) => {
    try {
        const email = req.query.email;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ fullName: user.fullName, email: user.email, governorate: user.governorate, telephone: user.telephone });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user info' });
    }
});

// Update profile endpoint
app.post('/updateProfile', async (req, res) => {
    try {
        const { email, fullName, governorate, telephone } = req.body;
        const user = await User.findOneAndUpdate(
            { email },
            { fullName, governorate, telephone },
            { new: true }
        );
        if (user) {
            res.status(200).json({ message: 'Profile updated successfully' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Update profile endpoint for Campgrp
app.post('/updateCampgrpinfos', upload.single('picture'), async (req, res) => {
    try {
        const { email, name, governorate, telephone, chefName, creationDate, socialMediaLink, comments } = req.body;
        let picture = req.body.picture;

        if (req.file) {
            picture = req.file.path;
        }

        const campgrp = await Campgrp.findOneAndUpdate(
            { email },
            { name, governorate, telephone, chefName, picture, creationDate, socialMediaLink, comments },
            { new: true }
        );
        if (campgrp) {
            res.status(200).json({ message: 'Profile updated successfully' });
        } else {
            res.status(404).json({ message: 'Camping group not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile' });
    }
});

// Change password endpoint
app.post('/changePassword', async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.password !== oldPassword) { // For a more secure app, use hashed passwords with bcrypt
            return res.status(400).json({ message: 'Old password is incorrect' });
        }
        user.password = newPassword; // Ensure you hash the new password if using bcrypt
        await user.save();
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error changing password' });
    }
});

// OAuth2 setup
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL = process.env.EMAIL;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendMail(email, subject, text) {
    try {
        const accessToken = await oAuth2Client.getAccessToken();

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: EMAIL,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                refreshToken: REFRESH_TOKEN,
                accessToken: accessToken.token,
            },
        });

        const mailOptions = {
            from: EMAIL,
            to: email,
            subject: subject,
            text: text,
        };

        const result = await transporter.sendMail(mailOptions);
        return result;
    } catch (error) {
        console.error('Error sending email:', error);
        throw new Error('Error sending email');
    }
}

// Forgot Password endpoint
app.get('/forgotPassword', async (req, res) => {
    try {
        const { email } = req.query;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User Email not found' });
        }

        const subject = 'Campspotter - Password Recovery';
        const text = `Hi ${user.fullName},

As per your request, we have recovered your account password. Here are your login details:

Email: ${user.email}
Password: ${user.password}

For security reasons, we recommend that you log in and change your password immediately.

If you did not request this, please contact our support team immediately.

Best regards,
Campspotter Team.
`;

        const mailResult = await sendMail(email, subject, text);
        if (mailResult) {
            res.status(200).json({ message: 'Password recovery email sent' });
        } else {
            res.status(500).json({ message: 'Error sending email' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error handling forgot password request' });
    }
});

// Register endpoint for Campgrp
app.post('/registerCampgrp', upload.single('picture'), async (req, res) => {
    try {
        const { name, email, telephone, governorate, chefName, creationDate, socialMediaLink, comments, password } = req.body;
        let picture = null;

        if (req.file) {
            picture = req.file.path;
        }

        // Check if email is already registered as a camper
        const existingCamper = await User.findOne({ email });
        if (existingCamper) {
            return res.status(400).json({ message: 'Email already registered as a camper' });
        }

        const existingCampgrp = await Campgrp.findOne({ email });
        if (existingCampgrp) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const newCampgrp = new Campgrp({ name, email, telephone, governorate, chefName, picture, creationDate, socialMediaLink, comments, password });
        await newCampgrp.save();
        res.status(201).json({ message: 'Camping group registered successfully' });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            res.status(400).json({ message: 'Email already exists' });
        } else {
            res.status(500).json({ message: 'Error registering camping group' });
        }
    }
});

// Login endpoint for Campgrp
app.post('/loginCampgrp', async (req, res) => {
    try {
        const { email, password } = req.body;
        const campgrp = await Campgrp.findOne({ email });
        if (!campgrp) {
            return res.status(400).json({ message: 'Email does not exist' });
        }
        if (campgrp.password !== password) { // For a more secure app, use hashed passwords with bcrypt
            return res.status(400).json({ message: 'Email or password is incorrect' });
        }
        res.status(200).json({ name: campgrp.name, email: campgrp.email, governorate: campgrp.governorate, telephone: campgrp.telephone, chefName: campgrp.chefName, picture: campgrp.picture, creationDate: campgrp.creationDate, socialMediaLink: campgrp.socialMediaLink, comments: campgrp.comments });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Camping group info endpoint
app.get('/campgrpInfo', async (req, res) => {
    try {
        const email = req.query.email;
        const campgrp = await Campgrp.findOne({ email });
        if (!campgrp) {
            return res.status(404).json({ message: 'Camping group not found' });
        }
        res.status(200).json({ name: campgrp.name, email: campgrp.email, governorate: campgrp.governorate, telephone: campgrp.telephone, chefName: campgrp.chefName, picture: campgrp.picture, creationDate: campgrp.creationDate, socialMediaLink: campgrp.socialMediaLink, comments: campgrp.comments });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching camping group info' });
    }
});

// Forgot Password endpoint for Campgrp
app.get('/forgotPasswordCampgrp', async (req, res) => {
    try {
        const { email } = req.query;
        const campgrp = await Campgrp.findOne({ email });
        if (!campgrp) {
            return res.status(404).json({ message: 'Camping group email not found' });
        }

        const subject = 'Campspotter - Password Recovery';
        const text = `Hi ${campgrp.chefName} - ${campgrp.name} ,

As per your request, we have recovered your account password. Here are your login details:

Email: ${campgrp.email}
Password: ${campgrp.password}

For security reasons, we recommend that you log in and change your password immediately.

If you did not request this, please contact our support team immediately.

Best regards,
Campspotter Team.
`;

        const mailResult = await sendMail(email, subject, text);
        if (mailResult) {
            res.status(200).json({ message: 'Password recovery email sent' });
        } else {
            res.status(500).json({ message: 'Error sending email' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error handling forgot password request' });
    }
});

// Add Camp endpoint
app.post('/addCamp', upload.single('campPictureCover'), async (req, res) => {
    console.log(req.body);
    console.log(req.file);
    try {
        const { title, emplacement, date, duration, groupSize, ages, googleMapUrl, locationMaterials, description, highlights, campgrpEmail, prix, inclusion } = req.body;
        let campPictureCover = req.body.campPictureCover;

        if (req.file) {
            campPictureCover = req.file.path;
        }

        const newCamp = new Camp({
            title,
            emplacement,
            date,
            duration,
            groupSize,
            ages,
            googleMapUrl,
            locationMaterials,
            description,
            highlights,
            campgrpEmail,
            campPictureCover,
            prix,
            inclusion,
            status: '',
            reviewScore: 0,
        });
        await newCamp.save();
        res.status(201).json({ message: 'Camp added successfully', camp: newCamp });
    } catch (error) {
        console.error('Failed to add camp:', error); // Log the error for debugging
        res.status(500).json({ message: 'Failed to add camp', error });
    }
});

// Get Camps by Campgrp email
app.get('/campsByCampgrp', async (req, res) => {
    try {
        const email = req.query.email;
        const camps = await Camp.find(
            { campgrpEmail: email },
            'campPictureCover title emplacement prix duration reviewScore status date'
        ).sort({ _id: -1 }); // Sort by _id in descending order

        if (!camps) {
            return res.status(404).json({ message: 'No camps found for this camping group' });
        }
        res.status(200).json(camps);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching camps', error });
    }
});

// Endpoint to get a single camp by ID
app.get('/camp/:id', async (req, res) => {
    try {
        const camp = await Camp.findById(req.params.id);
        if (!camp) {
            return res.status(404).json({ message: 'Camp not found' });
        }
        res.json(camp);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all camps
app.get('/allCamps', async (req, res) => {
    try {
        const camps = await Camp.find({}, 'campPictureCover title emplacement prix duration reviewScore status date').sort({ _id: -1 }); // Sort by _id in descending order

        if (!camps) {
            return res.status(404).json({ message: 'No camps found' });
        }
        res.status(200).json(camps);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching camps', error });
    }
});

// Reservation endpoint
app.post('/reserve', async (req, res) => {
    const { reservationId, campId, campName, date, name, email, reservationDate, totalPrice, selectedExtras, comments } = req.body;

    // Check if the user has already reserved
    const existingReservation = await Reservation.findOne({ campId, email });
    if (existingReservation) {
        return res.status(400).json({ message: 'User has already reserved this camp' });
    }

    const newReservation = new Reservation({
        reservationId,
        campId,
        campName,
        date,
        name,
        email,
        reservationDate,
        totalPrice,
        selectedExtras,
        comments,
    });

    try {
        await newReservation.save();
        res.status(201).json({ message: 'Reservation successful' });
    } catch (error) {
        res.status(500).json({ message: 'Error making reservation', error });
    }
});

// Check reservation status endpoint
app.get('/check-reservation', async (req, res) => {
    const { campId, userEmail } = req.query;
    try {
        const reservation = await Reservation.findOne({ campId, email: userEmail });
        if (reservation) {
            res.status(200).json({ reserved: true });
        } else {
            res.status(200).json({ reserved: false });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Endpoint to get the number of current reservations for a camp
app.get('/camp-reservations', async (req, res) => {
    const { campId } = req.query;
    try {
        const reservations = await Reservation.countDocuments({ campId });
        res.status(200).json({ reservations });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch reservations by user email
app.get('/api/reservations', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        console.log(`Fetching reservations for email: ${email}`);
        // Find reservations by user email and populate camp data
        const reservations = await Reservation.find({ email }).populate('campId');
        console.log('Fetched reservations:', reservations);
        res.status(200).json(reservations);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Fetch all camp groups
app.get('/allCampGroups', async (req, res) => {
    try {
        const campGroups = await Campgrp.find();
        res.json(campGroups);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Endpoint to fetch camp group details by email
app.get('/campGroup/:email', async (req, res) => {
    try {
        const campgrp = await Campgrp.findOne({ email: req.params.email });
        if (campgrp) {
            res.status(200).json(campgrp);
        } else {
            res.status(404).json({ message: 'Camp group not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
});

// Add or update a review
app.post('/addOrUpdateReview', async (req, res) => {
    const { campGrpEmail, camperEmail, score } = req.body;

    try {
        let review = await GrpReview.findOne({ campGrpEmail, camperEmail });

        if (review) {
            review.score = score;
            await review.save();
            res.status(200).json({ message: 'Review updated successfully' });
        } else {
            review = new GrpReview({ campGrpEmail, camperEmail, score });
            await review.save();
            res.status(201).json({ message: 'Review added successfully' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error adding or updating review', error });
    }
});

// Fetch review by camper
app.get('/getReview', async (req, res) => {
    const { campGrpEmail, camperEmail } = req.query;

    try {
        const review = await GrpReview.findOne({ campGrpEmail, camperEmail });
        if (review) {
            res.status(200).json(review);
        } else {
            res.status(404).json({ message: 'Review not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching review', error });
    }
});

// Get reviews for a group
app.get('/getGroupReviews', async (req, res) => {
    try {
        const campGrpEmail = req.query.campGrpEmail;
        const reviews = await GrpReview.find({ campGrpEmail });
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reviews' });
    }
});

// Cancel group
app.patch('/camps/:id', async (req, res) => {
    try {
        const camp = await Camp.findByIdAndUpdate(
            req.params.id,
            { status: req.body.status },
            { new: true }
        );
        if (!camp) {
            return res.status(404).send('Camp not found');
        }
        res.send(camp);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Endpoint to add a comment
app.post('/addComment', async (req, res) => {
    const { campId, camperEmail, rating, comment } = req.body;
    try {
        // Check if the user is a camper
        const camper = await User.findOne({ email: camperEmail });
        if (!camper) {
            return res.status(403).json({ message: 'Only campers can comment and rate' });
        }

        // Save the comment with the camper's full name
        const newComment = new CampComment({ campId, camperEmail, camperFullName: camper.fullName, rating, comment });
        await newComment.save();
        res.status(201).json({ message: 'Comment added successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
});

// Endpoint to fetch comments for a camp
app.get('/comments/:campId', async (req, res) => {
    try {
        const comments = await CampComment.find({ campId: req.params.campId });
        res.status(200).json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
});

// Endpoint to Camp score rate
app.get('/campComments/rating/:campId', async (req, res) => {
    const campId = req.params.campId;
    try {
        const campComments = await CampComment.find({ campId: campId });
        let totalRating = 0;
        campComments.forEach(comment => {
            totalRating += comment.rating;
        });
        const averageRating = totalRating / campComments.length;
        res.json({ rating: averageRating });
    } catch (error) {
        console.error('Error fetching camp rating:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Fetch all camps by camp group email
app.get('/api/camps', async (req, res) => {
    const { campgrpEmail } = req.query;
    if (!campgrpEmail) {
        return res.status(400).json({ message: "Camp group email is required" });
    }

    try {
        const camps = await Camp.find({ campgrpEmail: campgrpEmail });
        if (camps.length > 0) {
            res.status(200).json(camps);
        } else {
            res.status(404).json({ message: 'No camps found for this email' });
        }
    } catch (error) {
        console.error('Error fetching camps:', error);
        res.status(500).json({ message: "Failed to fetch camps", error: error });
    }
});

// Endpoint to fetch reservations by campId
app.get('/api/fetch-reservations', async (req, res) => {
    const { campId } = req.query;
    if (!campId) {
        return res.status(400).json({ message: "Camp ID is required" });
    }

    try {
        const reservations = await Reservation.find({ campId: campId });
        res.status(200).json(reservations);
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ message: "Failed to fetch reservations", error: error });
    }
});

// Fetch user information by email
app.get('/api/user-info', async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user information:', error);
        res.status(500).json({ message: "Failed to fetch user information", error: error });
    }
});

// Reviews Statistics Endpoint
app.get('/api/reviews/stats', async (req, res) => {
    const { email } = req.query;
    try {
        const reviews = await GrpReview.find({ campGrpEmail: email });
        const totalReviews = reviews.length;
        const averageScore = totalReviews > 0 ? reviews.reduce((acc, review) => acc + review.score, 0) / totalReviews : 0;
        res.status(200).json({ averageScore, totalReviews });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching review stats', error });
    }
});

// Reservations Statistics Endpoint
app.get('/api/reservations/stats', async (req, res) => {
    const { email } = req.query;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
        const camps = await Camp.find({ campgrpEmail: email });
        const campIds = camps.map(camp => camp._id);
        const totalReservations = await Reservation.countDocuments({ campId: { $in: campIds } });
        const monthReservations = await Reservation.countDocuments({
            campId: { $in: campIds },
            date: { $gte: thirtyDaysAgo }
        });
        res.status(200).json({ total: totalReservations, thisMonth: monthReservations });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching reservation stats', error });
    }
});

// Camps Statistics Endpoint
app.get('/api/camps/stats', async (req, res) => {
    const { email } = req.query;
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    try {
        const totalCamps = await Camp.countDocuments({ campgrpEmail: email });
        const recentCamps = await Camp.countDocuments({
            campgrpEmail: email,
            date: { $gte: sixMonthsAgo }
        });
        res.status(200).json({ total: totalCamps, recent: recentCamps });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching camps stats', error });
    }
});

// Revenue Statistics Endpoint
app.get('/api/revenue/stats', async (req, res) => {
    const { email } = req.query;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    try {
        const camps = await Camp.find({ campgrpEmail: email });
        const campIds = camps.map(camp => camp._id);
        const reservations = await Reservation.find({ campId: { $in: campIds } });
        const totalRevenue = reservations.reduce((acc, res) => acc + res.totalPrice, 0);
        const monthReservations = await Reservation.find({
            campId: { $in: campIds },
            date: { $gte: thirtyDaysAgo }
        });
        const monthRevenue = monthReservations.reduce((acc, res) => acc + res.totalPrice, 0);
        res.status(200).json({ total: totalRevenue, thisMonth: monthRevenue });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching revenue stats', error });
    }
});

// Blog post endpoint
// Configure multer storage for blog images
const blogStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/blogimg/';
        fs.mkdirSync(dir, { recursive: true }); // Ensure the directory exists
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

// Filter for blog image uploads to ensure only images are uploaded
const blogImageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload only images.'), false);
    }
};

// Configure multer for blog image uploads
const blogUpload = multer({
    storage: blogStorage,
    fileFilter: blogImageFilter,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB
    }
});

// Blog post endpoint with custom multer configuration for images
app.post('/api/blogs', blogUpload.single('coverImage'), async (req, res) => {
    console.log('Received request:', req.body);
    console.log('Received file:', req.file);

    const { title, description, type, creatorName, articleText, tags, campgrpEmail, likesCount, status } = req.body;
    if (!title || !description || !articleText || !campgrpEmail || !req.file) {
        return res.status(400).json({ error: "All fields must be filled, including the cover image." });
    }

    const blog = new Blog({
        title,
        description,
        type,
        creatorName,
        articleText,
        coverImage: req.file.path, // This now stores the path of the image in the blogimg directory
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [], // Process tags cleanly
        campgrpEmail,
        date: new Date(),
        likesCount: parseInt(likesCount, 10) || 0,
        status: status || 'pending'  // Set default status to 'pending' if not provided
    });

    try {
        await blog.save();
        res.status(201).json({ message: 'Blog added successfully', blogId: blog._id });
    } catch (error) {
        console.error("Error saving blog:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to fetch the latest three approved blogs
app.get('/latestblogs', async (req, res) => {
    try {
        const blogs = await Blog.find({ status: 'approved' }).sort({ date: -1 }).limit(3);
        res.json(blogs);
    } catch (error) {
        console.error("Failed to fetch blogs:", error);
        res.status(500).json({ message: 'Failed to fetch blogs', error });
    }
});

// Endpoint to fetch all blogs with optional type filter and only if status is approved
app.get('/blogs', async (req, res) => {
    const { type } = req.query;  // Get the type from query parameters
    try {
        const query = { status: 'approved' };  // Filter by approved status
        if (type) {
            query.type = type;  // If type is provided, add it to the query
        }
        const blogs = await Blog.find(query).sort({ date: -1 });
        res.status(200).json(blogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ message: 'Failed to fetch blogs' });
    }
});

// GET blog by ID
app.get('/api/blogs/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ message: "Blog not found" });
        }
        if (blog.status === "approved") {
            res.json(blog);
        } else {
            res.status(403).json({ message: "Blog is not approved" });
        }
    } catch (error) {
        console.error("Error fetching blog:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/blogs', async (req, res) => {
    try {
        const { email } = req.query;
        const blogs = await Blog.find({ campgrpEmail: email });
        res.json(blogs);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.put('/api/blogs/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        await Blog.findByIdAndUpdate(id, { status: 'cancelled' });
        res.send('Blog status updated');
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

app.get('/', (req, res) => {
    res.send('Welcome to Campspotter API!');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
