const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        unique: true,
        maxlength: [100, 'Category name cannot exceed 100 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    icon: {
        type: String,
        default: '📁'
    },
    image: {
        type: String,
        default: null
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    is_active: {
        type: Boolean,
        default: true
    },
    is_trending: {
        type: Boolean,
        default: false
    },
    is_new: {
        type: Boolean,
        default: false
    },
    is_popular: {
        type: Boolean,
        default: false
    },
    talent_count: {
        type: Number,
        default: 0
    },
    gig_count: {
        type: Number,
        default: 0
    },
    sort_order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Auto-generate slug from name before save
categorySchema.pre('save', async function () {
    if (this.isModified('name') || !this.slug) {
        this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
});

module.exports = mongoose.model('Category', categorySchema);
