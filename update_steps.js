const mongoose = require('mongoose');
const RegistrationStep = require('./models/RegistrationStep');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Update Categories
        await RegistrationStep.updateOne(
            { field: 'categories' },
            { $set: { applicableRoles: ['client', 'freelancer', 'investor', 'startup_creator'] } }
        );

        // Update Skills (if exists)
        await RegistrationStep.updateOne(
            { field: 'skills' },
            { $set: { applicableRoles: ['freelancer'] } }
        );

        // Update Work Preference
        await RegistrationStep.updateOne(
            { field: 'workPreference' },
            { $set: { applicableRoles: ['client', 'freelancer'] } }
        );

        // Update Budget
        await RegistrationStep.updateOne(
            { field: 'budgetRange' },
            { $set: { applicableRoles: ['client', 'freelancer'] } }
        );

        // Update Experience
        await RegistrationStep.updateOne(
            { field: 'experienceLevel' },
            { $set: { applicableRoles: ['client', 'freelancer'] } }
        );

        console.log('Successfully updated onboarding step roles.');
        process.exit(0);
    } catch (err) {
        console.error('Update Error:', err);
        process.exit(1);
    }
}

run();
