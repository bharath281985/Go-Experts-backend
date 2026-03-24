const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
    // Unique key — only one settings document ever exists
    _id: { type: String, default: 'site_settings' },

    // Brand
    site_name: { type: String, default: 'Go Experts' },
    site_tagline: { type: String, default: 'Find the best freelancers' },
    site_logo: { type: String, default: '/logo.png' },
    site_favicon: { type: String, default: '' },

    // Contact
    contact_email: { type: String, default: '' },
    contact_phone: { type: String, default: '' },
    contact_address: { type: String, default: '' },

    // SEO
    meta_title: { type: String, default: '' },
    meta_description: { type: String, default: '' },
    meta_keywords: { type: String, default: '' },

    // Social Links
    social_facebook: { type: String, default: '' },
    social_twitter: { type: String, default: '' },
    social_linkedin: { type: String, default: '' },
    social_instagram: { type: String, default: '' },
    social_github: { type: String, default: '' },
    social_youtube: { type: String, default: '' },

    // Platform Config
    commission_rate: { type: Number, default: 10 },       // % platform takes per transaction
    currency: { type: String, default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    maintenance_mode: { type: Boolean, default: false },

    // Points system
    points_per_rupee: { type: Number, default: 1 },
    points_signup_bonus: { type: Number, default: 100 },

    // Home Page CMS (Mock data elimination)
    home_stats: [{
        label: String,
        value: Number,
        suffix: String,
        icon: String // icon name from lucide
    }],
    trust_badges: [String],

    // Email Settings (SMTP)
    smtp_host: { type: String, default: 'mail.doorstephub.com' },
    smtp_port: { type: String, default: '465' },
    smtp_user: { type: String, default: 'support@doorstephub.com' },
    smtp_pass: { type: String, default: 'gW2I;K&fv((?Jw@)' },
    email_from: { type: String, default: 'support@doorstephub.com' },
    email_from_name: { type: String, default: 'Go Experts' },
    email_reply_to: { type: String, default: 'support@doorstephub.com' },
    email_encryption: { type: String, default: 'SSL' }, // TLS, SSL, or None
    footer_copyright: { type: String, default: '© 2026 Go Experts. All rights reserved.' },

}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
