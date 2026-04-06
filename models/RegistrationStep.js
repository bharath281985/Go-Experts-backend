const mongoose = require('mongoose');

const registrationStepSchema = new mongoose.Schema({
    order: {
        type: Number,
        required: true
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
    module: {
        type: String,
        enum: ['onboarding', 'project_finder', 'talent_finder'],
        default: 'onboarding'
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

registrationStepSchema.index({ module: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('RegistrationStep', registrationStepSchema);
