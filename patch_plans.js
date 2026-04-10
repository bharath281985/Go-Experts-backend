const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const SubscriptionPlan = require('./models/SubscriptionPlan');
const UserSubscription = require('./models/UserSubscription');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Patch subscription plans
        const result = await SubscriptionPlan.updateMany(
            { startup_idea_post_limit: { $exists: false } },
            { $set: { startup_idea_post_limit: 3, startup_idea_explore_limit: 3 } }
        );
        
        console.log(`Updated ${result.modifiedCount} plans without limits.`);

        // Also patch active UserSubscriptions that don't have the limits set
        const resultSubs = await UserSubscription.updateMany(
            { remaining_startup_posts: { $exists: false } },
            { $set: { remaining_startup_posts: 3, remaining_idea_unlocks: 3 } }
        );

        console.log(`Updated ${resultSubs.modifiedCount} user active subscriptions without limits.`);

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
