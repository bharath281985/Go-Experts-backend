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
  applicableRoles: Array,
  validation: Object
}, { timestamps: true });

const RegistrationStep = mongoose.models.RegistrationStep || mongoose.model('RegistrationStep', RegistrationStepSchema);

const talentSteps = [
  {
    title: "What do you want to hire?",
    description: "Choose the expertise you need for your team.",
    field: "role",
    type: "single-selection",
    module: "talent_finder",
    order: 1,
    label: "Role",
    options: []
  },
  {
    title: "What type of engagement?",
    description: "How do you want to hire this talent?",
    field: "workType",
    type: "single-selection",
    module: "talent_finder",
    order: 2,
    label: "Work Type",
    options: [
      { value: "one-time", label: "One-time project", subtitle: "Single project completion", icon: "Briefcase" },
      { value: "part-time", label: "Part-time", subtitle: "20-30 hours/week", icon: "Clock" },
      { value: "full-time", label: "Full-time", subtitle: "40+ hours/week", icon: "Clock" },
      { value: "hourly", label: "Hourly support", subtitle: "As needed basis", icon: "DollarSign" }
    ]
  },
  {
    title: "Monthly Budget Range",
    description: "What is your target budget for this hire?",
    field: "budget",
    type: "single-selection",
    module: "talent_finder",
    order: 3,
    label: "Budget",
    options: [
      { value: "50k-100k", label: "₹50k - ₹1L", subtitle: "Entry Level", icon: "DollarSign" },
      { value: "100k-200k", label: "₹1L - ₹2L", subtitle: "Intermediate", icon: "DollarSign" },
      { value: "200k+", label: "₹2L+", subtitle: "Expert / Top-rated", icon: "Award" },
      { value: "fixed", label: "Fixed Budget", subtitle: "Project-based", icon: "Shield" }
    ]
  },
  {
    title: "Experience Level",
    description: "Select the minimum expertise level required.",
    field: "experience",
    type: "single-selection",
    module: "talent_finder",
    order: 4,
    label: "Experience",
    options: [
      { value: "beginner", label: "Beginner", subtitle: "0-2 years", emoji: "🌱" },
      { value: "intermediate", label: "Intermediate", subtitle: "2-5 years", emoji: "⚡" },
      { value: "expert", label: "Expert", subtitle: "5+ years", emoji: "🏆" },
      { value: "top-rated", label: "Top Rated", subtitle: "Platform verified", emoji: "⭐" }
    ]
  },
  {
    title: "Location Preference",
    description: "Where should the talent be located?",
    field: "location",
    type: "single-selection",
    module: "talent_finder",
    order: 5,
    label: "Location",
    options: [
      { value: "remote", label: "Remote only", subtitle: "Global talent", icon: "Globe" },
      { value: "hybrid", label: "Hybrid", subtitle: "Office + Home", icon: "MapPin" },
      { value: "onsite", label: "Onsite", subtitle: "Office only", icon: "Building" }
    ]
  },
  {
    title: "When to start?",
    description: "Target start date for this role.",
    field: "availability",
    type: "single-selection",
    module: "talent_finder",
    order: 6,
    label: "Availability",
    options: [
      { value: "now", label: "Available now", emoji: "🟢" },
      { value: "7days", label: "Within 7 days", emoji: "🟡" },
      { value: "15days", label: "Within 15 days", emoji: "🟠" },
      { value: "custom", label: "Custom date", emoji: "📅" }
    ]
  },
  {
    title: "Tell us about specific skills",
    description: "Which specific technologies or soft skills do you need?",
    field: "skills",
    type: "multi-selection",
    module: "talent_finder",
    order: 7,
    label: "Skills",
    options: []
  },
  {
    title: "Extra Preferences",
    description: "Optional requirements to narrow down talent.",
    field: "preferences",
    type: "multi-selection",
    module: "talent_finder",
    order: 8,
    label: "Preferences",
    options: [
      { value: "english", label: "English fluent", icon: "Globe" },
      { value: "portfolio", label: "Portfolio required", icon: "FileText" },
      { value: "verified", label: "Verified Identity", icon: "Shield" },
      { value: "agency", label: "Agency talent", icon: "Briefcase" }
    ]
  }
];

async function seedTalentSteps() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/goex-backend';
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    await RegistrationStep.deleteMany({ module: 'talent_finder' });
    console.log('Deleted existing.');

    await RegistrationStep.insertMany(talentSteps);
    console.log('🚀 Seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('CRITICAL ERROR:', error.message);
    process.exit(1);
  }
}

seedTalentSteps();
