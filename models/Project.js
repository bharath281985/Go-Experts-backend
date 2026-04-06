const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    client_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: [true, 'Please add a project title']
    },
    description: {
        type: String,
        required: [true, 'Please add a project description']
    },
    category: String,
    location: String,
    timeline: String, // e.g., "1 week", "1 month"
    experience_level: {
        type: String,
        default: 'Intermediate'
    },
    budget_range: {
        type: String, // e.g., "500-1000"
        required: true
    },
    skills_required: [String],
    attachments: [String],
    image: String,
    is_featured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['pending', 'live', 'closed', 'paused', 'completed', 'rejected', 'flagged'],
        default: 'pending'
    },
    hired_freelancer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
