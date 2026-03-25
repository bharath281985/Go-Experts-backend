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
        order: 1,
        label: 'Account Type',
        title: 'How do you want to use Go Experts?',
        description: 'Choose Your Primary Role',
        type: 'single-selection',
        field: 'accountType',
        options: [
            { value: 'client', label: 'Hire Talent', emoji: '🎯', description: 'I want to hire freelancers for my projects' },
            { value: 'freelancer', label: 'Work as Freelancer', emoji: '💼', description: 'I want to offer my services and find work' },
            { value: 'investor', label: 'Investor', emoji: '💰', description: 'I want to invest in startup ideas' },
            { value: 'startup_creator', label: 'Startup Creator', emoji: '🚀', description: 'I want to share my startup ideas and find investors' },
            { value: 'both', label: 'Both', emoji: '🔁', description: 'I want to hire and work as a freelancer' }
        ]
    },
    {
        order: 2,
        label: 'Plans',
        title: 'Choose the best plan for you',
        description: 'Select a plan that fits your needs',
        type: 'subscription-plan',
        field: 'subscriptionPlan'
    },
    {
        order: 3,
        label: 'Categories',
        title: 'What services are you interested in?',
        description: 'Select all that apply',
        type: 'multi-selection',
        field: 'categories',
        options: [
            { value: 'uiux', label: 'UI/UX Design', icon: 'Palette' },
            { value: 'webdev', label: 'Web Development', icon: 'Code' },
            { value: 'mobiledev', label: 'Mobile Apps', icon: 'Smartphone' },
            { value: 'marketing', label: 'Digital Marketing', icon: 'TrendingUp' },
            { value: 'writing', label: 'Content Writing', icon: 'FileText' },
            { value: 'video', label: 'Video Editing', icon: 'Video' },
            { value: 'security', label: 'Cybersecurity', icon: 'Shield' },
            { value: 'consulting', label: 'Business Consulting', icon: 'Building' }
        ]
    },
    {
        order: 4,
        label: 'Work Style',
        title: 'How do you prefer to work?',
        description: 'Choose your work style',
        type: 'single-selection',
        field: 'workPreference',
        options: [
            { value: 'remote', label: 'Remote', icon: 'Globe' },
            { value: 'onsite', label: 'Onsite', icon: 'MapPin' },
            { value: 'hybrid', label: 'Hybrid', icon: 'MapPin' }
        ]
    },
    {
        order: 5,
        label: 'Budget',
        title: "What's your budget or rate range?",
        description: 'Select the range that fits best',
        type: 'single-selection',
        field: 'budgetRange',
        options: [
            { value: '5k-15k', label: '₹5K - ₹15K', subtitle: 'Starter' },
            { value: '15k-50k', label: '₹15K - ₹50K', subtitle: 'Standard' },
            { value: '50k-1l', label: '₹50K - ₹1L', subtitle: 'Premium' },
            { value: '1l+', label: '₹1L+', subtitle: 'Enterprise' }
        ]
    },
    {
        order: 6,
        label: 'Experience',
        title: 'Choose your experience level',
        description: 'This helps us match you better',
        type: 'single-selection',
        field: 'experienceLevel',
        options: [
            { value: 'beginner', label: 'Beginner', emoji: '🌱' },
            { value: 'intermediate', label: 'Intermediate', emoji: '⚡' },
            { value: 'expert', label: 'Expert', emoji: '🏆' }
        ]
    },
    {
        order: 7,
        label: 'Location',
        title: 'Where are you based?',
        description: 'Optional - helps with local opportunities',
        type: 'input',
        field: 'location'
    },
    {
        order: 8,
        label: 'Availability',
        title: 'What is your availability?',
        description: 'Choose when you can start',
        type: 'single-selection',
        field: 'availability',
        options: [
            { value: 'fulltime', label: 'Full-time' },
            { value: 'parttime', label: 'Part-time' },
            { value: 'weekends', label: 'Weekends' }
        ]
    },
    {
        order: 9,
        label: 'Create Account',
        title: 'Final Step: Create your account',
        description: 'Enter your details to complete registration',
        type: 'account-creation',
        field: 'account'
    }
];

const importData = async () => {
    try {
        await RegistrationStep.deleteMany();
        await RegistrationStep.insertMany(seedSteps);
        console.log('Data Imported!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

connectDB().then(importData);
