const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Fix DNS issues if any
dns.setDefaultResultOrder("ipv4first");
dns.setServers(['8.8.8.8', '8.8.4.4']);

const SubscriptionPlan = require('./models/SubscriptionPlan');

const uri = process.env.MONGODB_URI;

const plans = [
    {
        name: "Free Trial Plan (90 Days)",
        price: 0,
        duration_days: 90,
        points_granted: 100,
        project_post_limit: 5,
        project_visit_limit: 5,
        portfolio_visit_limit: 5,
        interest_click_limit: 5,
        features: [
            "Profile Listing",
            "Basic Search Visibility",
            "Basic Support (Email Only)",
            "Up to 5 Project/Task Applications",
            "Create up to 5 Gigs (Concepts or Ready-to-use Templates)"
        ],
        target_role: "both",
        billing_cycle: "one-time",
        status: "enabled"
    },
    {
        name: "Standard Plan (Growth) ⭐ Most Popular",
        price: 999, // User needs to update this manually if they prefer another price
        duration_days: 30, // 30 days common for standard growth
        points_granted: 365,
        project_post_limit: 36,
        project_visit_limit: 36,
        portfolio_visit_limit: 36,
        interest_click_limit: 36,
        features: [
            "Profile Listing",
            "Recommended Search Visibility (Improved Ranking)",
            "Dedicated Support (Email & WhatsApp)",
            "Up to 36 Project/Task Applications",
            "Create up to 36 Gigs (Concepts or Ready-to-use Templates)",
            "💬 Live Chat Enabled",
            "🎁 365 Points Credited"
        ],
        target_role: "both",
        billing_cycle: "monthly",
        status: "enabled"
    },
    {
        name: "Premium Plan (Pro)",
        price: 2999, // User needs to update this manually
        duration_days: 30,
        points_granted: 5000, 
        project_post_limit: 999999, // effectively unlimited
        project_visit_limit: 999999,
        portfolio_visit_limit: 999999,
        interest_click_limit: 999999,
        features: [
            "Profile Listing",
            "Recommended Search Visibility (Top Ranking Priority)",
            "Dedicated Support (Email, WhatsApp & Priority Assistance)",
            "♾️ Unlimited Project/Task Applications",
            "♾️ Unlimited Gigs (Concepts or Ready-to-use Templates)",
            "💬 Live Chat Enabled",
            "💸 Zero Commission on Earnings"
        ],
        target_role: "both",
        billing_cycle: "monthly",
        status: "enabled"
    }
];

async function seedPlans() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB successfully");
        
        // Remove existing plans
        await SubscriptionPlan.deleteMany({});
        console.log("Cleared existing Subscription Plans");
        
        // Insert new plans
        await SubscriptionPlan.insertMany(plans);
        console.log("Successfully seeded new Subscription Plans!");
        
        process.exit(0);
    } catch (e) {
        console.error("FAILED_WITH_ERROR:", e.message);
        process.exit(1);
    }
}

seedPlans();
