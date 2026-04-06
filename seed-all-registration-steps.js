const mongoose = require('mongoose');
require('dotenv').config();

const RegistrationStepSchema = new mongoose.Schema({
  title: String,
  description: String,
  field: String,
  type: String,
  module: String,
  order: Number,
  label: String,
  options: Array,
  isActive: { type: Boolean, default: true }, // IMPORTANT: This was missing!
  applicableRoles: Array,
  validation: Object
}, { timestamps: true });

const RegistrationStep = mongoose.models.RegistrationStep || mongoose.model('RegistrationStep', RegistrationStepSchema);

const onboardingSteps = [
    { order: 1, label: 'Account Type', title: 'How do you want to use Go Experts?', description: 'Choose Your Primary Role', type: 'single-selection', field: 'accountType', module: 'onboarding', isActive: true, options: [
        { value: 'client', label: 'Hire Talent', emoji: '🎯', description: 'I want to hire freelancers for my projects' },
        { value: 'freelancer', label: 'Work as Freelancer', emoji: '💼', description: 'I want to offer my services and find work' },
        { value: 'investor', label: 'Investor', emoji: '💰', description: 'I want to invest in startup ideas' },
        { value: 'startup_creator', label: 'Startup Creator', emoji: '🚀', description: 'I want to share my startup ideas and find investors' },
        { value: 'both', label: 'Both', emoji: '🔁', description: 'I want to hire and work as a freelancer' }
    ]},
    { order: 2, label: 'Plans', title: 'Choose the best plan for you', description: 'Select a plan that fits your needs', type: 'subscription-plan', field: 'subscriptionPlan', module: 'onboarding', isActive: true },
    { order: 3, label: 'Categories', title: 'What services are you interested in?', description: 'Select all that apply', type: 'multi-selection', field: 'categories', module: 'onboarding', isActive: true, options: [] },
    { order: 4, label: 'Work Style', title: 'How do you prefer to work?', description: 'Choose your work style', type: 'single-selection', field: 'workPreference', module: 'onboarding', isActive: true, options: [
        { value: 'remote', label: 'Remote', icon: 'Globe' },
        { value: 'onsite', label: 'Onsite', icon: 'MapPin' },
        { value: 'hybrid', label: 'Hybrid', icon: 'MapPin' }
    ]},
    { order: 5, label: 'Budget', title: "What's your budget range?", description: 'Select the range that fits best', type: 'single-selection', field: 'budgetRange', module: 'onboarding', isActive: true, options: [
        { value: '5k-15k', label: '₹5K - ₹15K', subtitle: 'Starter' },
        { value: '15k-50k', label: '₹15K - ₹50K', subtitle: 'Standard' },
        { value: '50k-1l', label: '₹50K - ₹1L', subtitle: 'Premium' },
        { value: '1l+', label: '₹1L+', subtitle: 'Enterprise' }
    ]},
    { order: 6, label: 'Experience', title: 'Choose your experience level', description: 'This helps us match you better', type: 'single-selection', field: 'experienceLevel', module: 'onboarding', isActive: true, options: [
        { value: 'beginner', label: 'Beginner', emoji: '🌱' },
        { value: 'intermediate', label: 'Intermediate', emoji: '⚡' },
        { value: 'expert', label: 'Expert', emoji: '🏆' }
    ]},
    { order: 7, label: 'Location', title: 'Where are you based?', description: 'Optional - helps with local opportunities', type: 'input', field: 'location', module: 'onboarding', isActive: true },
    { order: 8, label: 'Availability', title: 'What is your availability?', description: 'Choose when you can start', type: 'single-selection', field: 'availability', module: 'onboarding', isActive: true, options: [
        { value: 'fulltime', label: 'Full-time' },
        { value: 'parttime', label: 'Part-time' },
        { value: 'weekends', label: 'Weekends' }
    ]},
    { order: 9, label: 'Account', title: 'Final Step: Create account', description: 'Enter details to complete registration', type: 'account-creation', field: 'account', module: 'onboarding', isActive: true }
];

const projectFinderSteps = [
  { order: 1, label: "Project Type", title: "What kind of project?", description: "Select the service category for your project.", field: "projectType", type: "single-selection", module: "project_finder", isActive: true, options: [] },
  { order: 2, label: "Pricing", title: "Pricing Model", description: "How do you want to pay?", field: "priceType", type: "single-selection", module: "project_finder", isActive: true, options: [
      { value: "fixed", label: "Fixed Price", subtitle: "Set total budget", icon: "Shield" },
      { value: "hourly", label: "Hourly Rate", subtitle: "Pay per hour", icon: "Clock" }
  ]},
  { order: 3, label: "Budget", title: "What's your budget?", description: "Estimated investment for this project.", field: "budget", type: "single-selection", module: "project_finder", isActive: true, options: [
      { value: "1k-5k", label: "₹1k - ₹5k", subtitle: "Small Tasks", icon: "DollarSign" },
      { value: "5k-20k", label: "₹5k - ₹20k", subtitle: "Standard Project", icon: "Briefcase" },
      { value: "20k+", label: "₹20k+", subtitle: "Large Scale", icon: "Award" }
  ]},
  { order: 4, label: "Timeline", title: "Expected Timeline", description: "When do you need this completed?", field: "timeline", type: "single-selection", module: "project_finder", isActive: true, options: [
      { value: "7days", label: "Within 7 Days", icon: "Clock" },
      { value: "30days", label: "Within 30 Days", icon: "Calendar" },
      { value: "flexible", label: "Flexible", icon: "Globe" }
  ]},
  { order: 5, label: "Experience", title: "Expertise Needed", description: "What level of pro do you need?", field: "experience", type: "single-selection", module: "project_finder", isActive: true, options: [
      { value: "beginner", label: "Beginner", emoji: "🌱" },
      { value: "intermediate", label: "Intermediate", emoji: "⚡" },
      { value: "expert", label: "Expert", emoji: "🏆" }
  ]},
  { order: 6, label: "Location", title: "Preferred Location", description: "Where should the expert be based?", field: "workPreference", type: "single-selection", module: "project_finder", isActive: true, options: [
      { value: "remote", label: "Remote", icon: "Globe" },
      { value: "anywhere", label: "Anywhere", icon: "MapPin" }
  ]},
  { order: 7, label: "Skills", title: "Specific Skills", description: "Select specific technologies needed.", field: "skills", type: "multi-selection", module: "project_finder", isActive: true, options: [] },
  { order: 8, label: "Filters", title: "Extra Filters", description: "Optional refinements.", field: "extraFilters", type: "multi-selection", module: "project_finder", isActive: true, options: [
      { value: "verified", label: "Verified Only", icon: "Shield" },
      { value: "active", label: "Recently Active", icon: "TrendingUp" }
  ]}
];

const talentFinderSteps = [
  { order: 1, label: "Role", title: "What do you want to hire?", description: "Choose the expertise you need.", field: "role", type: "single-selection", module: "talent_finder", isActive: true, options: [] },
  { order: 2, label: "Work Type", title: "What type of engagement?", description: "How do you want to hire?", field: "workType", type: "single-selection", module: "talent_finder", isActive: true, options: [
      { value: "one-time", label: "One-time project", icon: "Briefcase" },
      { value: "part-time", label: "Part-time", icon: "Clock" },
      { value: "full-time", label: "Full-time", icon: "Clock" }
  ]},
  { order: 3, label: "Budget", title: "Monthly Budget Range", description: "Target budget for this hire.", field: "budget", type: "single-selection", module: "talent_finder", isActive: true, options: [
      { value: "50k-100k", label: "₹50k - ₹1L", icon: "DollarSign" },
      { value: "100k-200k", label: "₹1L - ₹2L", icon: "DollarSign" },
      { value: "200k+", label: "₹2L+", icon: "Award" }
  ]},
  { order: 4, label: "Experience", title: "Experience Level", description: "Minimum expertise level required.", field: "experience", type: "single-selection", module: "talent_finder", isActive: true, options: [
      { value: "beginner", label: "Beginner", emoji: "🌱" },
      { value: "intermediate", label: "Intermediate", emoji: "⚡" },
      { value: "expert", label: "Expert", emoji: "🏆" }
  ]},
  { order: 5, label: "Location", title: "Location Preference", description: "Where should the talent be located?", field: "location", type: "single-selection", module: "talent_finder", isActive: true, options: [
      { value: "remote", label: "Remote only", icon: "Globe" },
      { value: "hybrid", label: "Hybrid", icon: "MapPin" }
  ]},
  { order: 6, label: "Availability", title: "When to start?", description: "Target start date.", field: "availability", type: "single-selection", module: "talent_finder", isActive: true, options: [
      { value: "now", label: "Available now", emoji: "🟢" },
      { value: "7days", label: "Within 7 days", emoji: "🟡" }
  ]},
  { order: 7, label: "Skills", title: "Specific skills?", description: "Which specific technologies do you need?", field: "skills", type: "multi-selection", module: "talent_finder", isActive: true, options: [] },
  { order: 8, label: "Preferences", title: "Extra Preferences", description: "Optional requirements.", field: "preferences", type: "multi-selection", module: "talent_finder", isActive: true, options: [
      { value: "english", label: "English fluent", icon: "Globe" },
      { value: "verified", label: "Verified ID", icon: "Shield" }
  ]}
];

async function seedEverything() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI missing in .env");
    
    await mongoose.connect(uri);
    console.log('Connected.');

    await RegistrationStep.deleteMany({});
    console.log('Cleaned.');

    await RegistrationStep.insertMany([
        ...onboardingSteps,
        ...projectFinderSteps,
        ...talentFinderSteps
    ]);
    
    console.log('🚀 25 steps with isActive:true seeded!');
    process.exit(0);
  } catch (error) {
    console.error('FAILED:', error);
    process.exit(1);
  }
}

seedEverything();
