const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const Blog = require('./models/Blog'); // adjust the path as necessary
require('dotenv').config();

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

const uploadFolderToCloudinary = async (folderPath) => {
    try {
        const files = fs.readdirSync(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.lstatSync(filePath).isDirectory()) {
                await uploadFolderToCloudinary(filePath);
            } else {
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: 'blogimg',
                });

                // Convert both backslashes and forward slashes to match MongoDB path
                const localPath = filePath.replace(/\\/g, '/');
                const regex = new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\/\\\\]'), 'i');

                const updatedDocument = await Blog.findOneAndUpdate(
                    { coverImage: regex },
                    { $set: { coverImage: result.secure_url } },
                    { new: true }
                );

                if (updatedDocument) {
                    console.log(`Updated document with ID ${updatedDocument._id}: ${result.secure_url}`);
                } else {
                    console.log(`No matching document found for image: ${filePath}`);
                }

                console.log(`Uploaded ${filePath} to ${result.secure_url}`);
            }
        }
    } catch (error) {
        console.error('Error uploading images:', error);
    }
};

const startUpload = async () => {
    await uploadFolderToCloudinary('uploads/blogimg');
};

startUpload().then(() => {
    console.log('All images uploaded');
    mongoose.disconnect();
});
