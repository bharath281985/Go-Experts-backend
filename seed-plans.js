const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

// Fix DNS issues if any
dns.setDefaultResultOrder("ipv4first");
dns.setServers(['8.8.8.8', '8.8.4.4']);

const SubscriptionPlan = require('./models/SubscriptionPlan');
const SiteSettings = require('./models/SiteSettings');

const uri = process.env.MONGODB_URI;

const plans = [
    // --- FREE TRIAL PLANS ---
    {
        name: "Freelancer Free Trial",
        price: 0,
        duration_days: 14,
        project_post_limit: 0,
        project_visit_limit: 5,
        portfolio_visit_limit: 2,
        interest_click_limit: 5,
        chat_limit: 2,
        features: [
            "14-Day Free Trial",
            "Apply to 5 projects",
            "Basic profile visibility"
        ],
        badge: "Trial",
        cta: "Start 14-Day Free Trial",
        featured: false,
        group: "Freelancer Plans",
        target_role: "freelancer",
        billing_cycle: "one-time",
        status: "enabled",
        icon: "Gift",
        color_theme: "orange"
    },
    {
        name: "Client Free Trial",
        price: 0,
        duration_days: 14,
        project_post_limit: 1,
        task_post_limit: 1,
        chat_limit: 5,
        features: [
            "14-Day Free Trial",
            "Post 1 project",
            "Evaluate up to 5 freelancers"
        ],
        badge: "Trial",
        cta: "Start 14-Day Free Trial",
        featured: false,
        group: "Client Plans",
        target_role: "client",
        billing_cycle: "one-time",
        status: "enabled",
        icon: "Gift",
        color_theme: "orange"
    },
    {
        name: "Investor Free Trial",
        price: 0,
        duration_days: 14,
        project_post_limit: 0,
        database_access_limit: 5,
        features: [
            "14-Day Free Trial",
            "View up to 5 startup ideas",
            "Test platform features"
        ],
        badge: "Trial",
        cta: "Start 14-Day Free Trial",
        featured: false,
        group: "Investor Plans",
        target_role: "investor",
        billing_cycle: "one-time",
        status: "enabled",
        icon: "Gift",
        color_theme: "orange"
    },
    {
        name: "Startup Creator Free Trial",
        price: 0,
        duration_days: 14,
        startup_idea_post_limit: 1,
        chat_limit: 5,
        features: [
            "14-Day Free Trial",
            "Post 1 startup idea",
            "Connect with limited investors"
        ],
        badge: "Trial",
        cta: "Start 14-Day Free Trial",
        featured: false,
        group: "Start-Up Idea Creator Plans",
        target_role: "startup_creator",
        billing_cycle: "one-time",
        status: "enabled",
        icon: "Gift",
        color_theme: "orange"
    },

    // --- CLIENT PLANS (NEW UPDATED) ---
    {
        name: "Basic Client",
        price: 3650,
        duration_days: 365,
        project_post_limit: 36,
        task_post_limit: 36,
        chat_limit: 36,
        features: [
            "Post up to 36 projects per year",
            "Post up to 36 Tasks",
            "Direct Freelancer Hiring",
            "Public Profile Visibility",
            "Project Receive request via e-mail",
            "Basic Freelancer Chat Access",
            "Email support from Admin"
        ],
        badge: "Entry Plan",
        cta: "Choose Client Basic",
        featured: false,
        group: "Client Plans",
        target_role: "client",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Building",
        color_theme: "green"
    },
    {
        name: "Pro Client",
        price: 7500,
        duration_days: 365,
        project_post_limit: 75,
        task_post_limit: 75,
        database_access_limit: 99,
        chat_limit: 9999, // Assuming unlimited or very high
        features: [
            "Post up to 75 projects",
            "Post up to 75 Tasks",
            "99 Freelancer Database Access",
            "Advanced tools and filters",
            "Saved Freelancer",
            "Recommended Visibility for Tasks and Projects",
            "Email and chat support from Admin"
        ],
        badge: "Popular",
        cta: "Choose Client Pro",
        featured: true,
        group: "Client Plans",
        target_role: "client",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Rocket",
        color_theme: "blue"
    },
    {
        name: "Enterprise Client",
        price: 19999,
        duration_days: 365,
        project_post_limit: 199,
        task_post_limit: 9999,
        chat_limit: 9999,
        features: [
            "Post up to 199 projects",
            "Dedicated Hiring Dashboard",
            "Featured Project and Task Visibility",
            "Direct chat with freelancer",
            "Dedicated Email Support From Admin",
            "Gold color badge included"
        ],
        badge: "Enterprise",
        cta: "Choose Enterprise",
        featured: false,
        group: "Client Plans",
        target_role: "client",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Crown",
        color_theme: "gold"
    },

    // --- FREELANCER PLANS (CLEANUP) ---
    {
        name: "Basic Freelancer",
        price: 3650,
        duration_days: 365,
        project_post_limit: 0,
        project_visit_limit: 30,
        portfolio_visit_limit: 10,
        interest_click_limit: 30,
        chat_limit: 10,
        features: [
            "Public freelancer profile",
            "Apply to 30 projects per month",
            "Receive direct hire requests",
            "Client chat access",
            "Email support from admin"
        ],
        badge: "Growth",
        cta: "Choose Freelancer Basic",
        featured: false,
        group: "Freelancer Plans",
        target_role: "freelancer",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Briefcase",
        color_theme: "green"
    },
    {
        name: "Pro Freelancer",
        price: 5999,
        duration_days: 365,
        project_post_limit: 0,
        project_visit_limit: 9999,
        portfolio_visit_limit: 99,
        interest_click_limit: 9999,
        chat_limit: 9999,
        features: [
            "Unlimited project applications",
            "Priority listing in search",
            "Verified profile badge",
            "Priority inbox and client chat",
            "Email + chat support",
            "Access to premium client opportunities"
        ],
        badge: "Popular",
        cta: "Choose Freelancer Pro",
        featured: true,
        group: "Freelancer Plans",
        target_role: "freelancer",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Zap",
        color_theme: "blue"
    },

    // --- INVESTOR PLANS (CLEANUP) ---
    {
        name: "Basic Investor",
        price: 3650,
        duration_days: 365,
        project_post_limit: 0,
        database_access_limit: 20,
        features: [
            "Browse approved startup ideas",
            "Contact limited creators per month",
            "Save and bookmark startup ideas",
            "Email support from admin"
        ],
        badge: "Entry Plan",
        cta: "Choose Investor Basic",
        featured: false,
        group: "Investor Plans",
        target_role: "investor",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Eye",
        color_theme: "green"
    },
    {
        name: "Pro Investor",
        price: 9999,
        duration_days: 365,
        database_access_limit: 999,
        features: [
            "Unlimited startup idea access",
            "Direct contact with founders",
            "Advanced filters by industry and funding",
            "Early access to newly approved ideas",
            "Email + chat support"
        ],
        badge: "Popular",
        cta: "Choose Investor Pro",
        featured: true,
        group: "Investor Plans",
        target_role: "investor",
        billing_cycle: "yearly",
        status: "enabled",
        icon: "Target",
        color_theme: "gold"
    }
];

const subscriptionGroups = [
    { name: 'Freelancer Plans', label: 'Freelancer', icon: 'Briefcase', description: 'Built for professionals who want direct access to projects without losing earnings to commissions.' },
    { name: 'Client Plans', label: 'Client', icon: 'Building2', description: 'Designed for businesses and hiring teams looking to connect directly with skilled freelancers.' },
    { name: 'Start-Up Idea Creator Plans', label: 'Startup Creator', icon: 'Rocket', description: 'Perfect for founders who want to publish ideas, attract investors, and grow with subscription-based access.' },
    { name: 'Investor Plans', label: 'Investor', icon: 'Users', description: 'Created for investors who want streamlined access to quality startup ideas.' },
    { name: 'Combo Plan', label: 'Combo / All Access', icon: 'Layers', description: 'Full access to all platform features for multi-role users.' }
];

async function seedPlans() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB successfully");
        
        // Update Site Settings with groups
        await SiteSettings.updateOne(
            { _id: 'site_settings' },
            { $set: { subscription_groups: subscriptionGroups } },
            { upsert: true }
        );
        console.log("Updated Site Settings with Subscription Groups");

        // Remove existing plans
        await SubscriptionPlan.deleteMany({});
        console.log("Cleared existing Subscription Plans");
        
        // Insert new plans
        await SubscriptionPlan.insertMany(plans);
        console.log("Successfully seeded new Subscription Plans with icons and color themes!");
        
        process.exit(0);
    } catch (e) {
        console.error("FAILED_WITH_ERROR:", e.message);
        process.exit(1);
    }
}

seedPlans();
