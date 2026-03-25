const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startup_idea: { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    meeting_date: { type: Date, required: true },
    mode: { type: String, enum: ['Google Meet', 'Zoom', 'In-Person', 'Phone Call'], default: 'Google Meet' },
    agenda: { type: String },
    status: { type: String, enum: ['scheduled', 'completed', 'rescheduled', 'cancelled'], default: 'scheduled' },
    meeting_link: { type: String },
    notes: { type: String },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
