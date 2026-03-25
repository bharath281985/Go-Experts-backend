const mongoose = require('mongoose');
const dotenv = require('dotenv');
const StartupCategory = require('./models/StartupCategory');

dotenv.config();

const categories = [
    { name: 'Startup Idea', description: 'General startup concepts' },
    { name: 'Business Expansion', description: 'Strategies for scaling existing businesses' },
    { name: 'Tech / App Idea', description: 'Technology-driven solutions and mobile apps' },
    { name: 'Service Concept', description: 'Innovative service-based business models' },
    { name: 'Franchise Idea', description: 'Scalable franchise and chain models' },
    { name: 'Social Impact Idea', description: 'Ventures focusing on societal and environmental impact' }
];

const seedCategories = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/goexperts');
        
        console.log('Clearing existing startup categories...');
        await StartupCategory.deleteMany({});
        
        console.log('Seeding startup categories...');
        await StartupCategory.insertMany(categories);
        
        console.log('Seeding completed successfully!');
        process.exit();
    } catch (err) {
        console.error('Error seeding categories:', err);
        process.exit(1);
    }
};

seedCategories();
