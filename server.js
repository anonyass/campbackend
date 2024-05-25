const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const User = require('./models/User');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/campdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('Connection error', error);
});

// Register endpoint
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, telephone, governorate, password } = req.body;
        const newUser = new User({ fullName, email, telephone, governorate, password });
        await newUser.save();
        res.status(201).send('User registered successfully');
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            res.status(400).send('Email already exists');
        } else {
            res.status(500).send('Error registering user');
        }
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send('Email does not exist');
        }
        if (user.password !== password) { // For a more secure app, use hashed passwords with bcrypt
            return res.status(400).send('Email or password is incorrect');
        }
        res.status(200).json({ fullName: user.fullName, email: user.email, governorate: user.governorate, telephone: user.telephone });
    } catch (error) {
        res.status(500).send('Error logging in');
    }
});

// User info endpoint
app.get('/userinfo', async (req, res) => {
    try {
        const email = req.query.email;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.status(200).json({ fullName: user.fullName, email: user.email, governorate: user.governorate, telephone: user.telephone });
    } catch (error) {
        res.status(500).send('Error fetching user info');
    }
});

app.post('/updateProfile', async (req, res) => {
    try {
        const { email, fullName, governorate, telephone } = req.body;
        const user = await User.findOneAndUpdate(
            { email },
            { fullName, governorate, telephone },
            { new: true }
        );
        if (user) {
            res.status(200).send('Profile updated successfully');
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        res.status(500).send('Error updating profile');
    }
});

app.post('/changePassword', async (req, res) => {
    try {
        const { email, oldPassword, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }
        if (user.password !== oldPassword) { // For a more secure app, use hashed passwords with bcrypt
            return res.status(400).send('Old password is incorrect');
        }
        user.password = newPassword; // Ensure you hash the new password if using bcrypt
        await user.save();
        res.status(200).send('Password changed successfully');
    } catch (error) {
        res.status(500).send('Error changing password');
    }
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
