const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Project = require('./models/Project');
const Gig = require('./models/Gig');
const StartupIdea = require('./models/StartupIdea');

async function migrateStatuses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const projectResult = await Project.updateMany({ status: 'pending' }, { status: 'live' });
        console.log(`Updated ${projectResult.modifiedCount} pending projects to live.`);

        const gigResult = await Gig.updateMany({ status: 'pending' }, { status: 'live' });
        console.log(`Updated ${gigResult.modifiedCount} pending gigs to live.`);

        const ideaResult = await StartupIdea.updateMany({ status: 'pending' }, { status: 'approved' });
        console.log(`Updated ${ideaResult.modifiedCount} pending ideas to approved.`);

        process.exit(0);
    } catch (error) {
        console.error('Error during migration:', error);
        process.exit(1);
    }
}

migrateStatuses();
