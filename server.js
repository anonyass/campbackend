const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const User = require('./models/User');
const Campgrp = require('./models/Campgrp');

require('dotenv').config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use('/uploads', express.static('uploads')); // Serve static files from the uploads directory

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/campdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Connection error', error);
});

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
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
        const picture = req.file ? req.file.filename : req.body.picture;

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
        const picture = req.file ? req.file.filename : null;

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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
