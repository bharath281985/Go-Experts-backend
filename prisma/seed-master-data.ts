import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPERIENCE_LEVELS = [
  { label: "Beginner (0-2 yrs)", value: "Beginner", sortOrder: 1 },
  { label: "Intermediate (2-5 yrs)", value: "Intermediate", sortOrder: 2 },
  { label: "Senior (5-8 yrs)", value: "Senior", sortOrder: 3 },
  { label: "Expert (8+ yrs)", value: "Expert", sortOrder: 4 },
];

const STARTUP_STAGES = [
  { label: "Idea Phase", value: "Idea", sortOrder: 1 },
  { label: "MVP / Prototype", value: "MVP", sortOrder: 2 },
  { label: "Early Traction", value: "Early Traction", sortOrder: 3 },
  { label: "Growth & Scaling", value: "Growth", sortOrder: 4 },
  { label: "Pre-Seed / Seed", value: "Seed", sortOrder: 5 },
  { label: "Series A / B", value: "Series A", sortOrder: 6 },
];

const COMPANY_SIZES = [
  { label: "1-10 employees", value: "1-10", sortOrder: 1 },
  { label: "11-50 employees", value: "11-50", sortOrder: 2 },
  { label: "51-200 employees", value: "51-200", sortOrder: 3 },
  { label: "201-500 employees", value: "201-500", sortOrder: 4 },
  { label: "500+ employees", value: "500+", sortOrder: 5 },
];

const TICKET_SIZES = [
  { label: "â‚¹1 Lakh - â‚¹5 Lakhs", value: "1L-5L", min: 100000, max: 500000, sortOrder: 1 },
  { label: "â‚¹5 Lakhs - â‚¹25 Lakhs", value: "5L-25L", min: 500000, max: 2500000, sortOrder: 2 },
  { label: "â‚¹25 Lakhs - â‚¹1 Crore", value: "25L-1Cr", min: 2500000, max: 10000000, sortOrder: 3 },
  { label: "â‚¹1 Crore - â‚¹5 Crores", value: "1Cr-5Cr", min: 10000000, max: 50000000, sortOrder: 4 },
  { label: "â‚¹5 Crores+", value: "5Cr+", min: 50000000, max: 250000000, sortOrder: 5 },
];

const INVESTOR_TYPES = [
  { label: "Angel", value: "Angel", sortOrder: 1 },
  { label: "Individual", value: "Individual", sortOrder: 2 },
  { label: "Family office", value: "Family office", sortOrder: 3 },
  { label: "VC", value: "VC", sortOrder: 4 },
  { label: "Corporate", value: "Corporate", sortOrder: 5 },
  { label: "PE", value: "PE", sortOrder: 6 },
  { label: "Incubator/Accelerator", value: "Incubator/Accelerator", sortOrder: 7 },
  { label: "NRI Investor", value: "NRI Investor", sortOrder: 8 },
];

const FOUNDER_TYPES = [
  { label: "Idea Creator", value: "Idea Creator", sortOrder: 1 },
  { label: "Solo Founder", value: "Solo Founder", sortOrder: 2 },
  { label: "Co-Founder", value: "Co-Founder", sortOrder: 3 },
  { label: "Startup Team", value: "Startup Team", sortOrder: 4 },
  { label: "Existing Business Founder", value: "Existing Business Founder", sortOrder: 5 },
  { label: "Student Founder", value: "Student Founder", sortOrder: 6 },
  { label: "Tech Founder", value: "Tech Founder", sortOrder: 7 },
  { label: "Non-Tech Founder", value: "Non-Tech Founder", sortOrder: 8 },
];

const BUSINESS_TYPES = [
  { label: "Individual Client", value: "Individual Client", sortOrder: 1 },
  { label: "Small Business", value: "Small Business", sortOrder: 2 },
  { label: "Startup", value: "Startup", sortOrder: 3 },
  { label: "Agency", value: "Agency", sortOrder: 4 },
  { label: "Enterprise", value: "Enterprise", sortOrder: 5 },
  { label: "Shop Owner", value: "Shop Owner", sortOrder: 6 },
  { label: "Service Provider", value: "Service Provider", sortOrder: 7 },
  { label: "Manufacturer", value: "Manufacturer", sortOrder: 8 },
  { label: "Franchise Owner", value: "Franchise Owner", sortOrder: 9 },
  { label: "E-Commerce Brand", value: "E-Commerce Brand", sortOrder: 10 },
  { label: "Non-Profit & NGO", value: "Non-Profit & NGO", sortOrder: 11 },
  { label: "Educational Institution", value: "Educational Institution", sortOrder: 12 },
];

const TEAM_SIZES = [
  { label: "1 (Solo)", value: "1", min: 1, max: 1, sortOrder: 1 },
  { label: "2-5 members", value: "5", min: 2, max: 5, sortOrder: 2 },
  { label: "6-10 members", value: "10", min: 6, max: 10, sortOrder: 3 },
  { label: "11-25 members", value: "25", min: 11, max: 25, sortOrder: 4 },
  { label: "25+ members", value: "50", min: 25, max: 100, sortOrder: 5 },
];

const BUDGET_RANGES = [
  { label: "Under INR 10,000 ($100)", value: "Under INR 10,000", min: 0, max: 10000, sortOrder: 1 },
  { label: "INR 10,000 - INR 50,000 ($100-$600)", value: "INR 10,000 - INR 50,000", min: 10000, max: 50000, sortOrder: 2 },
  { label: "INR 50,000 - INR 2,00,000 ($600-$2,500)", value: "INR 50,000 - INR 2,00,000", min: 50000, max: 200000, sortOrder: 3 },
  { label: "INR 2,00,000 - INR 10,00,000 ($2,500-$12,500)", value: "INR 2,00,000 - INR 10,00,000", min: 200000, max: 1000000, sortOrder: 4 },
  { label: "INR 10,00,000+ ($12,500+)", value: "INR 10,00,000+", min: 1000000, max: 99999999, sortOrder: 5 },
];
const CLIENT_GOALS = [
  { label: "Hire Freelancer", value: "Hire Freelancer", sortOrder: 1 },
  { label: "Post a Project", value: "Post a Project", sortOrder: 2 },
  { label: "Hire Agency", value: "Hire Agency", sortOrder: 3 },
  { label: "Get Business Consultation", value: "Get Business Consultation", sortOrder: 4 },
  { label: "Build Website / App", value: "Build Website / App", sortOrder: 5 },
  { label: "Marketing Support", value: "Marketing Support", sortOrder: 6 },
  { label: "Design Services", value: "Design Services", sortOrder: 7 },
  { label: "Long-Term Team", value: "Long-Term Team", sortOrder: 8 },
  { label: "One-Time Service", value: "One-Time Service", sortOrder: 9 },
  { label: "Monthly Maintenance", value: "Monthly Maintenance", sortOrder: 10 },
];

const EXPANSION_GOALS = [
  { label: "Find Distributors", value: "Find Distributors", sortOrder: 1 },
  { label: "Find Suppliers", value: "Find Suppliers", sortOrder: 2 },
  { label: "Find Business Partners", value: "Find Business Partners", sortOrder: 3 },
  { label: "Seek Investors", value: "Seek Investors", sortOrder: 4 },
  { label: "Open Franchise", value: "Open Franchise", sortOrder: 5 },
  { label: "Cross-border Expansion", value: "Cross-border Expansion", sortOrder: 6 },
];

const FOUNDER_GOALS = [
  { label: "Looking for Investor", value: "Looking for Investor", sortOrder: 1 },
  { label: "Looking for Co-Founder", value: "Looking for Co-Founder", sortOrder: 2 },
  { label: "Looking for Mentor", value: "Looking for Mentor", sortOrder: 3 },
  { label: "Looking for Developer", value: "Looking for Developer", sortOrder: 4 },
  { label: "Looking for Marketing Support", value: "Looking for Marketing Support", sortOrder: 5 },
  { label: "Looking for Business Partner", value: "Looking for Business Partner", sortOrder: 6 },
  { label: "Looking for Clients", value: "Looking for Clients", sortOrder: 7 },
  { label: "Looking for Franchise Partners", value: "Looking for Franchise Partners", sortOrder: 8 },
  { label: "Looking for Funding + Tech Support", value: "Looking for Funding + Tech Support", sortOrder: 9 },
];

const INVESTMENT_MODES = [
  { label: "Equity", value: "Equity", sortOrder: 1 },
  { label: "Debt", value: "Debt", sortOrder: 2 },
  { label: "Convertible Note", value: "Convertible Note", sortOrder: 3 },
  { label: "SAFE", value: "SAFE", sortOrder: 4 },
  { label: "Partnership/JV", value: "Partnership/JV", sortOrder: 5 },
  { label: "Grants", value: "Grants", sortOrder: 6 },
];

const INVESTOR_GOALS = [
  { label: "Invest in Startups", value: "Invest in Startups", sortOrder: 1 },
  { label: "Discover Business Ideas", value: "Discover Business Ideas", sortOrder: 2 },
  { label: "Fund Existing Businesses", value: "Fund Existing Businesses", sortOrder: 3 },
  { label: "Partner with Founders", value: "Partner with Founders", sortOrder: 4 },
  { label: "Mentor Startups", value: "Mentor Startups", sortOrder: 5 },
  { label: "Buy Equity Stake", value: "Buy Equity Stake", sortOrder: 6 },
  { label: "Explore Franchise Opportunities", value: "Explore Franchise Opportunities", sortOrder: 7 },
];

const SERVICES_TAXONOMY: Record<string, string[]> = {
  "Website & App Development": ["Business Website", "E-commerce Website", "Custom Web App", "Mobile App (iOS/Android)", "Flutter & React Native", "Landing Page & Sales Funnel", "API & Backend Development", "DevOps & Cloud Deployment"],
  "Design & Branding": ["UI/UX Design", "Brand Identity & Logo", "Graphic Design", "Social Media Graphics", "3D Motion & Animation", "Video Editing & Production", "Packaging & Print Design"],
  "Digital Marketing & Growth": ["Search Engine Optimization (SEO)", "Google & Meta Paid Ads", "Social Media Management", "Content Marketing & Copywriting", "Email Marketing & Automation", "Influencer Marketing & PR"],
  "Business & Legal Consulting": ["Management & IT Consulting", "Accounting & Financial Planning", "Legal Tech & Contracts", "Market Research & Pitch Decks", "HR & Talent Acquisition"],
  "Artificial Intelligence & Data": ["AI Chatbots & Agents", "Machine Learning Models", "Data Engineering & Analytics", "NLP & Automation Pipelines", "Computer Vision Solutions"],
  "Healthcare & MedTech": ["Telemedicine Platforms", "EHR & Hospital Software", "Health Tracking Apps", "AI Diagnostics Tech"],
  "Real Estate & Construction": ["Property Listing & MLS", "Virtual Tours & 3D Rendering", "PropTech Management Software", "Architectural CAD Design"],
  "Manufacturing & Logistics": ["Industrial IoT & Automation", "Supply Chain Optimization", "Smart Factory Analytics", "CAD Engineering & Prototyping"],
};

const SUBSCRIPTION_PLANS = [
  { id: "freelancer-starter", name: "Freelancer Starter", role: "freelancer", price: 299, amount: 299, billingCycle: "month", duration: "monthly", desc: "Starter access plan", status: "active", visibility: "public" },
  { id: "freelancer-pro", name: "Freelancer Pro", role: "freelancer", price: 799, amount: 799, billingCycle: "month", duration: "monthly", desc: "Standard access plan", status: "active", visibility: "public" },
  { id: "freelancer-elite", name: "Freelancer Elite", role: "freelancer", price: 1499, amount: 1499, billingCycle: "month", duration: "monthly", desc: "Elite access plan with priority support", status: "active", visibility: "public" },
  { id: "freelancer-annual", name: "Freelancer Annual", role: "freelancer", price: 5999, amount: 5999, billingCycle: "year", duration: "yearly", desc: "Save 37% vs monthly plan", status: "active", visibility: "public" },
  { id: "client-pro", name: "Client Pro", role: "client", price: 1999, amount: 1999, billingCycle: "month", duration: "monthly", desc: "Unlimited project postings & direct hiring", status: "active", visibility: "public" },
  { id: "client-annual", name: "Client Annual", role: "client", price: 14999, amount: 14999, billingCycle: "year", duration: "yearly", desc: "Annual unlimited client subscription", status: "active", visibility: "public" },
];

async function seedMasterData() {
  console.log("ðŸŒ± Starting Master Data Database Seeding...\n");

  // 1. Seed ExperienceLevels in DB
  for (const exp of EXPERIENCE_LEVELS) {
    await prisma.experienceLevel.upsert({
      where: { name: exp.value },
      update: { status: "active" },
      create: { name: exp.value, status: "active" },
    }).catch(() => null);
  }
  console.log("âœ… Seeded Experience Levels in Database");

  // 2. Seed StartupStages in DB
  for (const stage of STARTUP_STAGES) {
    await prisma.startupStage.upsert({
      where: { name: stage.value },
      update: { status: "active" },
      create: { name: stage.value, status: "active" },
    }).catch(() => null);
  }
  console.log("âœ… Seeded Startup Stages in Database");

  // Ensure table exists via raw SQL if needed
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`master_options\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`type\` VARCHAR(191) NOT NULL,
        \`label\` VARCHAR(191) NOT NULL,
        \`value\` VARCHAR(191) NOT NULL,
        \`min\` DOUBLE NULL,
        \`max\` DOUBLE NULL,
        \`group_key\` VARCHAR(191) NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`metadata\` JSON NULL,
        \`status\` VARCHAR(191) NOT NULL DEFAULT 'active',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        INDEX \`master_options_type_status_idx\` (\`type\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => null);
  } catch {}

  // Helper for MasterOption upsert
  const upsertOptions = async (type: string, items: Array<{ label: string; value: string; min?: number; max?: number; groupKey?: string; sortOrder?: number; metadata?: any }>) => {
    const delegate = (prisma as any).masterOption;
    await Promise.all(
      items.map(async (item) => {
        const id = `mo_${type}_${item.value.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
        const metaStr = item.metadata ? JSON.stringify(item.metadata) : null;
        if (delegate && typeof delegate.upsert === "function") {
          await delegate.upsert({
            where: { id },
            update: {
              label: item.label,
              value: item.value,
              min: item.min ?? null,
              max: item.max ?? null,
              groupKey: item.groupKey ?? null,
              sortOrder: item.sortOrder ?? 0,
              metadata: metaStr,
              status: "active",
            },
            create: {
              id,
              type,
              label: item.label,
              value: item.value,
              min: item.min ?? null,
              max: item.max ?? null,
              groupKey: item.groupKey ?? null,
              sortOrder: item.sortOrder ?? 0,
              metadata: metaStr,
              status: "active",
            },
          }).catch(() => null);
        } else {
          await prisma.$executeRawUnsafe(`
            INSERT INTO \`master_options\` (\`id\`, \`type\`, \`label\`, \`value\`, \`min\`, \`max\`, \`group_key\`, \`sort_order\`, \`metadata\`, \`status\`, \`created_at\`, \`updated_at\`)
            VALUES ('${id}', '${type}', '${item.label.replace(/'/g, "\\'")}', '${item.value.replace(/'/g, "\\'")}', ${item.min ?? "NULL"}, ${item.max ?? "NULL"}, ${item.groupKey ? `'${item.groupKey}'` : "NULL"}, ${item.sortOrder ?? 0}, ${metaStr ? `'${metaStr}'` : "NULL"}, 'active', NOW(), NOW())
            ON DUPLICATE KEY UPDATE \`label\`='${item.label.replace(/'/g, "\\'")}', \`sort_order\`=${item.sortOrder ?? 0}, \`updated_at\`=NOW();
          `).catch(() => null);
        }
      })
    );
  };

  await upsertOptions("company_size", COMPANY_SIZES);
  console.log("âœ… Seeded Company Sizes in Database");

  await upsertOptions("ticket_size", TICKET_SIZES);
  console.log("âœ… Seeded Ticket Sizes in Database");

  await upsertOptions("investor_type", INVESTOR_TYPES);
  console.log("âœ… Seeded Investor Types in Database");

  await upsertOptions("founder_type", FOUNDER_TYPES);
  console.log("âœ… Seeded Founder Types in Database");

  await upsertOptions("business_type", BUSINESS_TYPES);
  console.log("âœ… Seeded Business Types in Database");

  await upsertOptions("team_size", TEAM_SIZES);
  console.log("âœ… Seeded Team Sizes in Database");

  await upsertOptions("budget_range", BUDGET_RANGES);
  console.log("Budget ranges seeded in Database");

  await upsertOptions("client_goal", CLIENT_GOALS);
  console.log("âœ… Seeded Client Goals in Database");

  await upsertOptions("expansion_goal", EXPANSION_GOALS);
  console.log("âœ… Seeded Expansion Goals in Database");

  await upsertOptions("founder_goal", FOUNDER_GOALS);
  console.log("âœ… Seeded Founder Goals in Database");

  await upsertOptions("investment_mode", INVESTMENT_MODES);
  console.log("âœ… Seeded Investment Modes in Database");

  await upsertOptions("investor_goal", INVESTOR_GOALS);
  console.log("âœ… Seeded Investor Goals in Database");

  // Seed Services Taxonomy
  const taxonomyItems: any[] = [];
  let sortOrder = 1;
  for (const [catName, subCats] of Object.entries(SERVICES_TAXONOMY)) {
    taxonomyItems.push({
      label: catName,
      value: catName,
      groupKey: "category",
      sortOrder: sortOrder++,
      metadata: { subCategories: subCats },
    });
    for (const sub of subCats) {
      taxonomyItems.push({
        label: sub,
        value: sub,
        groupKey: catName,
        sortOrder: sortOrder++,
      });
    }
  }
  await upsertOptions("service_taxonomy", taxonomyItems);
  console.log("âœ… Seeded Services Taxonomy & Project Categories in Database");

  // Seed Subscription Plans in DB
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        role: plan.role,
        amount: plan.amount,
        duration: plan.duration,
        status: plan.status,
        visibility: plan.visibility,
      },
      create: {
        id: plan.id,
        name: plan.name,
        role: plan.role,
        amount: plan.amount,
        duration: plan.duration,
        status: plan.status,
        visibility: plan.visibility,
      },
    }).catch(() => null);
  }
  console.log("âœ… Seeded Subscription Plans in Database");

  console.log("\nðŸŽ‰ All Master Data Successfully Seeded into Database!");
}

seedMasterData()
  .catch((e) => {
    console.error("âŒ Master Data Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

