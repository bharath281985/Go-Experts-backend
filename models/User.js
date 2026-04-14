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
        sparse: true, // Allows nulls to be unique
        lowercase: true,
        trim: true
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
    work_preference: String,
    experience_level: String,
    availability: String,
    budget_range: String,
    bio: String,
    phone_number: String,
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
        image: String, // Thumbnail for the project
        description: String,
        links: [String], // Multiple project links (GitHub, Live URL, etc.)
        duration_days: Number, // Project completion duration
        completion_date: Date
    }],
    kyc: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KYC'
    },
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
        educational: [String], // Array of file paths
        experience_letter: String // File path
    },
    work_images: [String], // Up to 5 images
    role: {
        type: String,
        enum: ['freelancer', 'client', 'admin', 'investor', 'startup_creator'],
        default: 'freelancer'
    },
    total_points: {
        type: Number,
        default: 100 // Default points for new registration (Free Trial)
    },
    wallet_balance: {
        type: Number,
        default: 0
    },
    is_email_verified: {
        type: Boolean,
        default: false
    },
    is_suspended: {
        type: Boolean,
        default: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    subscription_details: {
        plan_name: {
            type: String,
            default: 'Starter Free Plan'
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        start_date: {
            type: Date,
            default: Date.now
        },
        end_date: {
            type: Date,
            default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 Days Trial
        },
        project_credits: {
            type: Number,
            default: 0
        },
        portfolio_credits: {
            type: Number,
            default: 0
        },
        task_credits: {
            type: Number,
            default: 0
        },
        chat_credits: {
            type: Number,
            default: 0
        },
        db_credits: {
            type: Number,
            default: 0
        },
        reminder_sent_10d: {
            type: Boolean,
            default: false
        }
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
    favorite_ideas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea' }],
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
});

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Generate and hash password token
userSchema.methods.getResetPasswordToken = function () {
    const crypto = require('crypto');
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set expire
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    return resetToken;
};

// Generate and hash email verification token
userSchema.methods.getEmailVerificationToken = function () {
    const crypto = require('crypto');
    // Generate token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to emailVerificationToken field
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // Set expire (e.g., 24 hours)
    this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;

    return verificationToken;
};


module.exports = mongoose.model('User', userSchema);
