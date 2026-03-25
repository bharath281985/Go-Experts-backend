const mongoose = require('mongoose');

const startupDocumentSchema = new mongoose.Schema({
    startup_idea: { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    file_name: { type: String, required: true },
    file_path: { type: String, required: true },
    file_type: { 
        type: String, 
        enum: ['pitch_deck', 'financials', 'research', 'nda', 'other'], 
        required: true 
    },
    version: { type: String, default: 'v1' },
    size: { type: String }, // e.g., '2.4 MB'
    visibility: { 
        type: String, 
        enum: ['public', 'investor_only', 'private'], 
        default: 'investor_only' 
    },
    downloads: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('StartupDocument', startupDocumentSchema);
