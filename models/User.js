const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    full_name: {
        type: String,
        required: [true, 'Please add a name']
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    meta_title: {
        type: String,
        trim: true,
        maxlength: [180, 'Meta title cannot exceed 180 characters']
    },
    meta_keywords: {
        type: String,
        trim: true,
        maxlength: [500, 'Meta keywords cannot exceed 500 characters']
    },
    meta_description: {
        type: String,
        trim: true,
        maxlength: [500, 'Meta description cannot exceed 500 characters']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please add a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    roles: {
        type: [String],
        enum: ['freelancer', 'client', 'admin', 'investor', 'startup_creator'],
        default: ['freelancer']
    },
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    location: String,
    latitude: Number,
    longitude: Number,
    work_preference: String,
    experience_level: String,
    availability: String,
    budget_range: String,
    bio: {
        type: String,
        trim: true,
        maxlength: [5000, 'Bio cannot exceed 5000 characters']
    },
    phone_number: String,
    whatsapp_country_code: {
        type: String,
        required: [true, 'Please add a WhatsApp country code'],
        trim: true
    },
    whatsapp_number: {
        type: String,
        required: [true, 'Please add a WhatsApp number'],
        trim: true
    },
    business_or_alternative_country_code: {
        type: String,
        trim: true
    },
    business_or_alternative_number: {
        type: String,
        trim: true
    },
    country_code: String,
    profile_image: String,
    hourly_rate: {
        type: Number,
        default: 0
    },
    skills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill' }],
    experience_details: [{
        year_range: String,
        title: String,
        company: String,
        description: String
    }],
    education_details: [{
        year_range: String,
        title: String,
        institution: String,
        description: String
    }],
    role_title: String,
    languages: [String],
    completed_projects: { type: Number, default: 0 },
    happy_customers: { type: Number, default: 0 },
    review_score: { type: Number, default: 0 },
    review_count: { type: Number, default: 0 },
    portfolio: [{
        title: String,
        image: String,
        images: [String],
        description: {
            type: String,
            maxlength: [5000, 'Project description cannot exceed 5000 characters']
        },
        links: [String],
        duration_days: Number,
        completion_date: Date
    }],
    kyc_details: {
        pan_card: String,
        aadhar_card: String,
        is_verified: {
            type: Boolean,
            default: false
        }
    },
    kyc_status: {
        type: String,
        enum: ['unverified', 'basic_verified', 'fully_verified', 'premium_verified', 'rejected', 'pending'],
        default: 'unverified'
    },
    documents: {
        educational: [String],
        experience_letter: String
    },
    work_images: [String],
    total_points: {
        type: Number,
        default: 100
    },
    wallet_balance: {
        type: Number,
        default: 0
    },
    referral_code: {
        type: String,
        unique: true,
        sparse: true
    },
    referred_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    is_suspended: {
        type: Boolean,
        default: false
    },
    is_email_verified: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    subscription_details: {
        plan_name: { type: String, default: 'Starter Free Plan' },
        status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
        start_date: { type: Date, default: Date.now },
        end_date: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        project_credits: { type: Number, default: 0 },
        portfolio_credits: { type: Number, default: 0 },
        task_credits: { type: Number, default: 0 },
        chat_credits: { type: Number, default: 0 },
        db_credits: { type: Number, default: 0 }
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    favorite_ideas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea' }],
    favorite_users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    social_links: {
        facebook: String,
        twitter: String,
        linkedin: String,
        instagram: String,
        github: String,
        behance: String,
        dribbble: String,
        youtube: String
    },
    landing_page_image: String
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for KYC relationship
userSchema.virtual('kyc', {
    ref: 'KYC',
    localField: '_id',
    foreignField: 'user',
    justOne: true
});

userSchema.pre('save', async function () {
    // 1. Generate Referral Code if new
    if (this.isNew && !this.referral_code) {
        const now = new Date();
        const dateStr = now.getDate().toString().padStart(2, '0') + 
                        (now.getMonth() + 1).toString().padStart(2, '0') + 
                        now.getFullYear().toString().slice(-2);
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        this.referral_code = `GE${dateStr}${randomStr}`;
    }

    // 2. Generate Unique Username and public slug if missing.
    if ((!this.username || !this.slug) && this.full_name) {
        const primaryRole = Array.isArray(this.roles) && this.roles.length
            ? this.roles.find(role => role !== 'admin') || this.roles[0]
            : 'user';
        let nameSlug = this.full_name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        const User = this.constructor;
        if (!this.username) {
            let finalUsername = nameSlug;
            let exists = await User.findOne({ username: finalUsername });
            
            while (exists && exists._id.toString() !== this._id.toString()) {
                finalUsername = `${nameSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
                exists = await User.findOne({ username: finalUsername });
            }
            
            this.username = finalUsername;
        }

        if (!this.slug) {
            const baseSlug = `${primaryRole}-${nameSlug}`;
            let finalSlug = baseSlug;
            let exists = await User.findOne({ slug: finalSlug });
            
            while (exists && exists._id.toString() !== this._id.toString()) {
                finalSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
                exists = await User.findOne({ slug: finalSlug });
            }
            
            this.slug = finalSlug;
        }
    }

    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
});

userSchema.methods.getResetPasswordToken = function () {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(20).toString('hex');
    this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    return resetToken;
};

userSchema.methods.getEmailVerificationToken = function () {
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(20).toString('hex');
    this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
    return verificationToken;
};

module.exports = mongoose.model('User', userSchema);
