const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['freelancer', 'client', 'investor', 'startup_creator'],
        required: true
    },
    status: {
        type: String,
        enum: ['unverified', 'basic_verified', 'fully_verified', 'premium_verified', 'rejected', 'pending'],
        default: 'unverified'
    },
    
    // 🔹 Identity (Mandatory)
    identity: {
        full_name: String,
        dob: Date,
        nationality: String,
        mobile: String,
        is_mobile_verified: { type: Boolean, default: false },
        email: String,
        is_email_verified: { type: Boolean, default: false },
        profile_photo: String // URL/Path
    },

    // 🔹 Government ID Proof
    id_proof: {
        pan_card: String, // URL/Path
        aadhar_card: String, // URL/Path (masked preferred)
        passport: String, // URL/Path
        driving_license: String // URL/Path
    },

    // 🔹 Address Proof
    address_proof: {
        document_url: String, // Aadhaar/Utility/Statement
        document_type: { type: String, enum: ['aadhaar', 'utility_bill', 'bank_statement'] }
    },

    // 🔹 Financial Verification (Investor)
    financial_investor: {
        bank_details: {
            holder_name: String,
            account_number: String,
            ifsc_code: String,
            cancelled_cheque: String // URL/Path
        },
        investor_type: { type: String, enum: ['angel_investor', 'venture_capitalist', 'hni'] },
        ticket_size_range: String, // e.g., "₹5L – ₹5Cr+"
        experience_years: Number,
        preferred_sectors: [String],
        linkedin_profile: String,
        portfolio_url: String
    },

    // 🔹 Startup Details (Founder)
    startup_details: {
        startup_name: String,
        role: String, // CEO / Co-founder
        team_members: [String],
        linkedin_profile: String,
        pitch_deck: String, // URL/Path
        business_plan: String, // URL/Path
        financial_projections: String, // URL/Path
        demo_screenshots: [String]
    },

    // 🔹 Business Verification (KYB - Founder)
    business_verification: {
        is_registered: { type: Boolean, default: false },
        inc_certificate: String,
        gst_certificate: String,
        company_pan: String,
        cin_number: String,
        startup_india_cert: String
    },

    // 🔹 Legal & Compliance
    compliance: {
        nda_accepted: { type: Boolean, default: false },
        terms_accepted: { type: Boolean, default: false },
        ip_declaration: { type: Boolean, default: false },
        fraud_declaration: { type: Boolean, default: false },
        consent_checkbox: { type: Boolean, default: false },
        digital_signature: String // Optional premium
    },

    admin_remarks: String,
    verified_at: Date,
    last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('KYC', kycSchema);
