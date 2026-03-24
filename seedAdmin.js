const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        let admin = await User.findOne({ email: 'doorstephub@gmail.com' });
        
        if (admin) {
            console.log('Admin already exists, updating credentials...');
            admin.password = 'password123';
            admin.full_name = 'Admin User';
            admin.roles = ['admin', 'client', 'freelancer'];
            admin.total_points = 999999;
            await admin.save();
            console.log('Admin updated successfully');
        } else {
            admin = await User.create({
                full_name: 'Admin User',
                email: 'doorstephub@gmail.com',
                password: 'password123',
                roles: ['admin', 'client', 'freelancer'],
                total_points: 999999
            });
            console.log('Admin created successfully');
        }

        console.log('Admin created successfully');
        process.exit();
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
