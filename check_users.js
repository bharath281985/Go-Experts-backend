const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const User = require('./models/User');

dotenv.config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const total = await User.countDocuments({});
        const admins = await User.find({ roles: 'admin' }).select('email');
        console.log('Total Users:', total);
        console.log('Admins:', JSON.stringify(admins, null, 2));

        const active = await User.countDocuments({ 
            roles: { $ne: 'admin' },
            is_suspended: false,
            is_email_verified: true,
            is_deleted: { $ne: true }
        });
        const suspended = await User.countDocuments({ roles: { $ne: 'admin' }, is_suspended: true });
        const blockedQuery = {
            $or: [
                { is_suspended: true },
                { is_blocked: true },
                { status: 'blocked' },
                { kyc_status: 'rejected' }
            ]
        };
        const blocked = await User.countDocuments({ roles: { $ne: 'admin' }, ...blockedQuery });
        
        console.log('Suspended (is_suspended: true):', suspended);
        console.log('Blocked (Exact Backend Query):', blocked);

        const suspendedUsers = await User.find({ is_suspended: true }).select('full_name email is_suspended is_deleted');
        console.log('Suspended Users Detail:', JSON.stringify(suspendedUsers, null, 2));

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
}

checkUsers();
