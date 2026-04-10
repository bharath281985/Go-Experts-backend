const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Project = require('./models/Project');

async function checkProjects() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const stats = await Project.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        console.log('Project Stats:', JSON.stringify(stats, null, 2));

        const recentProjects = await Project.find().sort({ createdAt: -1 }).limit(5);
        console.log('Recent 5 Projects:', JSON.stringify(recentProjects, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkProjects();
