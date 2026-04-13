const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const generateUsername = (fullName) => {
    return fullName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .concat(Math.floor(1000 + Math.random() * 9000).toString());
};

const migrateUsernames = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        const users = await User.find({ username: { $exists: false } });
        console.log(`Found ${users.length} users without usernames.`);

        for (const user of users) {
            let baseUsername = user.full_name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
            
            // Check if base username is taken
            let username = baseUsername;
            let count = 1;
            while (await User.findOne({ username })) {
                username = `${baseUsername}${count}`;
                count++;
            }

            user.username = username;
            await user.save();
            console.log(`Updated user ${user.full_name} with username: ${username}`);
        }

        console.log('Migration completed successfully.');
        process.exit();
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
};

migrateUsernames();
