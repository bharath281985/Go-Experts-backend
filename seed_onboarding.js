const mongoose = require('mongoose');
const RegistrationStep = require('./models/RegistrationStep');
const Category = require('./models/Category');
require('dotenv').config();

const seedRegistrationSteps = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing steps to avoid order conflicts
        await RegistrationStep.deleteMany({});

        const steps = [
            {
                order: 1,
                label: 'Account Type',
                title: 'How do you want to use Go Experts?',
                description: 'We will personalize your experience based on your choice',
                type: 'single-selection',
                field: 'accountType',
                options: [
                    { label: 'Work as Freelancer', value: 'freelancer', icon: 'Briefcase', description: 'I want to offer my services and find projects' },
                    { label: 'Hire Talent', value: 'client', icon: 'Users', description: 'I want to post projects and hire experts' },
                    { label: 'Both', value: 'both', icon: 'Globe', description: 'I want to both hire and work as a freelancer' }
                ]
            },
            {
                order: 2,
                label: 'Categories',
                title: 'What are your areas of interest?',
                description: 'Select the categories that best describe your expertise or needs',
                type: 'multi-selection',
                field: 'categories',
                options: [] // This will be dynamically populated from real Categories in the frontend
            },
            {
                order: 3,
                label: 'Work Style',
                title: 'Preferred work environment?',
                description: 'Choose how you prefer to collaborate with others',
                type: 'single-selection',
                field: 'workPreference',
                options: [
                    { label: 'Remote', value: 'remote', icon: 'Globe', description: 'Work from anywhere in the world' },
                    { label: 'On-site', value: 'onsite', icon: 'MapPin', description: 'Work at a physical location' },
                    { label: 'Hybrid', value: 'hybrid', icon: 'Building', description: 'A mix of remote and on-site work' }
                ]
            },
            {
                order: 4,
                label: 'Budget',
                title: 'What is your typical budget?',
                description: 'This helps us show you relevant opportunities within your range',
                type: 'single-selection',
                field: 'budgetRange',
                options: [
                    { label: 'Starter', value: 'starter', icon: 'IndianRupee', subtitle: '₹1k - ₹10k', description: 'Small tasks and quick fixes' },
                    { label: 'Professional', value: 'professional', icon: 'DollarSign', subtitle: '₹10k - ₹50k', description: 'Standard projects and milestones' },
                    { label: 'Enterprise', value: 'enterprise', icon: 'Crown', subtitle: '₹50k+', description: 'Large scale projects and long term roles' }
                ]
            },
            {
                order: 5,
                label: 'Experience',
                title: 'What is your experience level?',
                description: 'Be honest! This helps build trust with potential partners',
                type: 'single-selection',
                field: 'experienceLevel',
                options: [
                    { label: 'Beginner', value: 'beginner', icon: 'Sparkles', description: 'New to this field or just starting' },
                    { label: 'Intermediate', value: 'intermediate', icon: 'TrendingUp', description: 'Have some professional projects under my belt' },
                    { label: 'Expert', value: 'expert', icon: 'Award', description: 'Highly skilled with years of experience' }
                ]
            },
            {
                order: 6,
                label: 'Location',
                title: 'Where are you based?',
                description: 'Your location helps in finding local opportunities or setting timezones',
                type: 'input',
                field: 'location',
                validation: { required: false }
            },
            {
                order: 7,
                label: 'Availability',
                title: 'What is your current availability?',
                description: 'Let others know when you are ready to start',
                type: 'single-selection',
                field: 'availability',
                options: [
                    { label: 'Full-time', value: 'full-time', icon: 'Clock', description: 'Available 40+ hours per week' },
                    { label: 'Part-time', value: 'part-time', icon: 'Calendar', description: 'Available 20-30 hours per week' },
                    { label: 'Freelance', value: 'freelance', icon: 'Briefcase', description: 'Available for flexible hours' }
                ]
            },
            {
                order: 8,
                label: 'Create Account',
                title: 'Final Step: Create your account',
                description: 'Enter your details to complete registration',
                type: 'account-creation',
                field: 'account-creation'
            }
        ];

        await RegistrationStep.create(steps);
        console.log('Registration steps seeded successfully');

        // Also ensure some categories exist for the dynamic part
        const categoryCount = await Category.countDocuments();
        if (categoryCount === 0) {
            const mockCategories = [
                { name: 'Web Development', icon: '🌐', is_active: true, sort_order: 1 },
                { name: 'Mobile Apps', icon: '📱', is_active: true, sort_order: 2 },
                { name: 'UI/UX Design', icon: '🎨', is_active: true, sort_order: 3 },
                { name: 'Digital Marketing', icon: '📈', is_active: true, sort_order: 4 },
                { name: 'Content Writing', icon: '✍️', is_active: true, sort_order: 5 },
                { name: 'Data Science', icon: '📊', is_active: true, sort_order: 6 }
            ];
            await Category.create(mockCategories);
            console.log('Mock categories seeded');
        }

        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedRegistrationSteps();
