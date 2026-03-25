const mongoose = require('mongoose');

const registrationStepSchema = new mongoose.Schema({
    order: {
        type: Number,
        required: true,
        unique: true
    },
    label: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    type: {
        type: String,
        enum: ['single-selection', 'multi-selection', 'input', 'otp-verification', 'account-creation', 'subscription-plan'],
        required: true
    },
    field: {
        type: String,
        required: true
    },
    options: [{
        value: String,
        label: String,
        icon: String, // lucide-react icon name or emoji
        description: String,
        subtitle: String,
        emoji: String
    }],
    validation: {
        required: {
            type: Boolean,
            default: true
        },
        pattern: String,
        errorMessage: String
    },
    isActive: {
        type: Boolean,
        default: true
    },
    applicableRoles: {
        type: [String],
        default: [] // Empty means all roles
    }
}, { timestamps: true });

module.exports = mongoose.model('RegistrationStep', registrationStepSchema);
