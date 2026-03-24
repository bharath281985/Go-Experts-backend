const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please tell us your name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        lowercase: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    subject: {
        type: String,
        required: [true, 'What is this about?'],
        trim: true
    },
    message: {
        type: String,
        required: [true, 'Please enter your message'],
        trim: true
    },
    is_responded: {
        type: Boolean,
        default: false
    },
    admin_notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
