const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    location: { type: String, enum: ['header', 'footer', 'user'], default: 'header' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu', default: null },
    order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    open_in_new_tab: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
