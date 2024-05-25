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

// Register endpoint in your backend (index.js)
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
// Add this to your backend (index.js)
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
        res.status(200).send('Login successful');
    } catch (error) {
        res.status(500).send('Error logging in');
    }
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
