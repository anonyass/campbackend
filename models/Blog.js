const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: String,
    creatorName: String,
    articleText: { type: String, required: true },
    coverImage: { type: String, required: true },  // This will store the path to the image
    tags: [String],
    campgrpEmail: { type: String, required: true },
    date: { type: Date, default: Date.now },
    likesCount: { type: Number, default: 0 },
    status: { type: String}  // Add status with a default value of 'Draft'
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
