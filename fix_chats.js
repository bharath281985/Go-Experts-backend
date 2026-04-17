const mongoose = require('mongoose');
require('dotenv').config({path: './.env'});

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const UserSubscription = mongoose.model('UserSubscription', new mongoose.Schema({}, { strict: false }));
    await UserSubscription.updateMany({}, { $set: { remaining_chats: 50, chat_credits_used: 0 } });
    console.log('Fixed remaining_chats limit correctly');
    process.exit(0);
}).catch(console.error);
