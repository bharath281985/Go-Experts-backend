const mongoose = require('mongoose');

const startupIdeaSchema = new mongoose.Schema({
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true }, // Links to category name
    title: { type: String, required: true },
    shortDescription: { type: String, required: true },
    detailedDescription: { type: String, required: true },
    problem: { type: String, required: true },
    solution: { type: String, required: true },
    uniqueness: { type: String },
    targetAudience: { type: String },
    marketSize: { type: String },
    competitorAnalysis: { type: String },
    fundingAmount: { type: String },
    useOfFunds: { type: String },
    milestones: { type: String },
    ndaRequired: { type: String, enum: ['Yes', 'No'], default: 'No' },
    signedNDA: { type: String }, // Path to the uploaded signed PDF
    pitchDeck: { type: String },
    youtubeUrl: { type: String },
    ideaImages: [{ type: String }],
    attachments: [{ type: String }],
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    views: { type: Number, default: 0 },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users who unlocked contact
    isFeatured: { type: Boolean, default: false },
    internalNotes: { type: String },
    tags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('StartupIdea', startupIdeaSchema);
