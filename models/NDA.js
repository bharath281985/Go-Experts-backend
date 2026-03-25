const mongoose = require('mongoose');

const ndaSchema = new mongoose.Schema({
    startup_idea: { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'active', 'expired'], default: 'active' },
    signed_date: { type: Date, default: Date.now },
    expiry_date: { type: Date },
    file_path: { type: String } // Path to signed NDA if any
}, { timestamps: true });

module.exports = mongoose.model('NDA', ndaSchema);
