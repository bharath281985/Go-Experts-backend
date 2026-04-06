const mongoose = require('mongoose');
const dotenv = require('dotenv');
const RegistrationStep = require('./models/RegistrationStep');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const seedSteps = [
    {
        order: 1, label: 'Account Type', title: 'Choose Your Journey', description: 'How do you plan to use Go Experts?',
        type: 'single-selection', field: 'accountType', module: 'onboarding',
        options: [
            { value: 'client', label: 'I want to hire talent', emoji: '🎯', description: 'Post projects and find top experts' },
            { value: 'freelancer', label: 'I want to work', emoji: '💼', description: 'Find projects and offer your services' },
            { value: 'investor', label: 'I want to invest', emoji: '💎', description: 'Discover early-stage startup ideas' },
            { value: 'startup_creator', label: 'I want to build', emoji: '💡', description: 'Share your startup idea with investors' }
        ]
    },
    {
        order: 2, label: 'Interest Area', title: 'What is your focus?', description: 'Select your primary categories',
        type: 'multi-selection', field: 'categories', module: 'onboarding',
        applicableRoles: [] // All roles
    },
    {
        order: 3, label: 'Project Goal', title: 'Tell us about your goal', description: "What's the main project you have in mind today?",
        type: 'input', field: 'projectIntent', module: 'onboarding',
        applicableRoles: ['client']
    },
    {
        order: 4, label: 'Expertise', title: 'What are your core skills?', description: 'This helps us match you with the right projects',
        type: 'multi-selection', field: 'skills', module: 'onboarding',
        applicableRoles: ['freelancer']
    },
    {
        order: 5, label: 'Experience', title: 'Experience Level', description: 'Select your professional seniority',
        type: 'single-selection', field: 'experienceLevel', module: 'onboarding',
        applicableRoles: ['freelancer'],
        options: [
            { value: 'beginner', label: 'Entry Level', emoji: '🌱' },
            { value: 'intermediate', label: 'Intermediate', emoji: '⚡' },
            { value: 'expert', label: 'Expert / Lead', emoji: '🏆' }
        ]
    },
    {
        order: 6, label: 'Work Style', title: 'Work Preference', description: 'Where do you prefer to do your work?',
        type: 'single-selection', field: 'workPreference', module: 'onboarding',
        applicableRoles: ['freelancer'],
        options: [
            { value: 'remote', label: 'Fully Remote', icon: 'Globe' },
            { value: 'onsite', label: 'Onsite / Office', icon: 'MapPin' },
            { value: 'hybrid', label: 'Hybrid Model', icon: 'MapPin' }
        ]
    },
    {
        order: 7, label: 'Project Scale', title: 'Typical Project Budget', description: 'This helps us filter the right talent for you',
        type: 'single-selection', field: 'budgetRange', module: 'onboarding',
        applicableRoles: ['client'],
        options: [
            { value: '5k-15k', label: '₹5K - ₹15K', subtitle: 'Small Tasks' },
            { value: '15k-50k', label: '₹15K - ₹50K', subtitle: 'Standard Projects' },
            { value: '50k-1l', label: '₹50K - ₹1L', subtitle: 'Large Scale' },
            { value: '1l+', label: '₹1L+', subtitle: 'Enterprise' }
        ]
    },
    {
        order: 8, label: 'Phase', title: 'Current Venture Phase', description: 'Where are you in the startup lifecycle?',
        type: 'single-selection', field: 'startupPhase', module: 'onboarding',
        applicableRoles: ['startup_creator', 'investor'],
        options: [
            { value: 'ideation', label: 'Ideation / MVP', emoji: '💡' },
            { value: 'pre-seed', label: 'Pre-Seed / Seed', emoji: '🌱' },
            { value: 'scaling', label: 'Scaling / Growth', emoji: '📈' }
        ]
    },
    {
        order: 9, label: 'Location', title: 'Base Location', description: 'Where are you currently located?',
        type: 'input', field: 'location', module: 'onboarding',
        applicableRoles: [] // Optional for all
    },
    {
        order: 10, label: 'Account', title: 'Create Your Secure Account', description: 'Secure your profile with your details',
        type: 'account-creation', field: 'account', module: 'onboarding'
    }
];

const importData = async () => {
    try {
        await RegistrationStep.deleteMany({ module: 'onboarding' });
        await RegistrationStep.insertMany(seedSteps);
        console.log('Onboarding Registration Steps Seeded Successfully!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB().then(importData);
