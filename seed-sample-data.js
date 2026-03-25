const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const StartupIdea = require('./models/StartupIdea');

dotenv.config();

const seedSampleData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/goexperts');
        
        console.log('Clearing existing sample users and ideas...');
        // await User.deleteMany({ email: 'sample@goexperts.in' });
        // await StartupIdea.deleteMany({});
        
        console.log('Creating sample freelancer user...');
        let user = await User.findOne({ email: 'sample@goexperts.in' });
        if (!user) {
            user = await User.create({
                full_name: 'Sample Freelancer',
                email: 'sample@goexperts.in',
                password: 'password123',
                roles: ['freelancer'],
                phone_number: '1234567890',
                is_email_verified: true,
                total_points: 500
            });
        }
        
        console.log('Seeding sample startup ideas...');
        const ideas = [
            {
                creator: user._id,
                category: 'Business Expansion',
                title: 'Global Retail Logistics Optimization',
                shortDescription: 'AI-powered solution for scaling retail operations for expansion into APAC markets.',
                detailedDescription: 'This project focuses on warehouse automation and real-time inventory tracking optimized for high-growth retail brands.',
                problem: 'Inefficient logistics prevent scaling.',
                solution: 'Predictive analytics for inventory.',
                status: 'approved',
                fundingAmount: '₹50L',
                views: 125
            },
            {
                creator: user._id,
                category: 'Tech / App Idea',
                title: 'Decentralized Freelance Escrow',
                shortDescription: 'A Web3 based escrow service for trustless freelance payments.',
                detailedDescription: 'A smart contract system that holds funds and releases them upon milestone completion.',
                problem: 'Payment disputes between clients and freelancers.',
                solution: 'Blockchain-based smart contracts.',
                status: 'approved',
                fundingAmount: '₹20L',
                views: 89
            },
            {
                creator: user._id,
                category: 'Startup Idea',
                title: 'Sustainable Packaging for QSR',
                shortDescription: 'Eco-friendly, biodegradable packaging solutions for the fast-food industry.',
                detailedDescription: 'A manufacturing setup that creates edible and compostable containers for takeaways.',
                problem: 'Plastic waste in the food industry.',
                solution: 'Seaweed-based packaging.',
                status: 'approved',
                fundingAmount: '₹1Cr',
                views: 240
            }
        ];
        
        await StartupIdea.insertMany(ideas);
        
        console.log('Sample data seeding completed successfully!');
        process.exit();
    } catch (err) {
        console.error('Error seeding sample data:', err);
        process.exit(1);
    }
};

seedSampleData();
