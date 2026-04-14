const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// ──────────────────────────────────────────────────────────────────────────────
// Run this script to create / reset the admin account on ANY MongoDB URI.
// Usage:
//   node seedAdminProd.js
//   MONGODB_URI="mongodb+srv://..." node seedAdminProd.js
// ──────────────────────────────────────────────────────────────────────────────

const ADMIN_EMAIL    = 'doorstephub@gmail.com';
const ADMIN_PASSWORD = 'password123';
const ADMIN_NAME     = 'Admin User';

// Minimal User schema (avoids loading full model with all hooks)
const userSchema = new mongoose.Schema({
    full_name:         String,
    email:             { type: String, unique: true },
    password:          { type: String, select: false },
    roles:             [String],
    total_points:      Number,
    is_email_verified: { type: Boolean, default: true },
}, { strict: false });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const run = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌  MONGODB_URI not set in environment');
        process.exit(1);
    }

    console.log('🔗  Connecting to:', uri.replace(/:([^@]+)@/, ':****@'));
    await mongoose.connect(uri);
    console.log('✅  Connected');

    let admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

    if (admin) {
        console.log('ℹ️   Admin already exists — resetting password & roles...');
        admin.password          = ADMIN_PASSWORD;
        admin.full_name         = ADMIN_NAME;
        admin.roles             = ['admin', 'client', 'freelancer'];
        admin.total_points      = 999999;
        admin.is_email_verified = true;
        await admin.save();
        console.log('✅  Admin updated');
    } else {
        await User.create({
            full_name:         ADMIN_NAME,
            email:             ADMIN_EMAIL,
            password:          ADMIN_PASSWORD,
            roles:             ['admin', 'client', 'freelancer'],
            total_points:      999999,
            is_email_verified: true,
        });
        console.log('✅  Admin created');
    }

    console.log(`\n📧  Email   : ${ADMIN_EMAIL}`);
    console.log(`🔑  Password: ${ADMIN_PASSWORD}`);
    process.exit(0);
};

run().catch(err => {
    console.error('❌  Error:', err.message);
    process.exit(1);
});
