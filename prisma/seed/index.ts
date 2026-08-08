import { prisma } from "../../src/config/database.js";
import { SKILL_CATEGORIES } from "./skill-categories.seed.js";
import { RAW_SKILLS } from "./skills.seed.js";
import { RAW_TECHNOLOGIES } from "./technologies.seed.js";
import { RAW_INDUSTRIES } from "./industries.seed.js";
import { RAW_DESIGNATIONS } from "./designations.seed.js";
import { RAW_MASTER_OPTIONS } from "./master-options.seed.js";

async function seedCountries() {
  console.log("Seeding Countries...");
  const countries = [
    { name: "India", code: "IN", phoneCode: "+91", currencyCode: "INR", currencySymbol: "₹", flag: "🇮🇳", isDefault: true, allowRegistration: true, taxRate: 18.0 },
    { name: "United States", code: "US", phoneCode: "+1", currencyCode: "USD", currencySymbol: "$", flag: "🇺🇸", isDefault: false, allowRegistration: true, taxRate: 0.0 },
    { name: "United Kingdom", code: "GB", phoneCode: "+44", currencyCode: "GBP", currencySymbol: "£", flag: "🇬🇧", isDefault: false, allowRegistration: true, taxRate: 20.0 },
    { name: "United Arab Emirates", code: "AE", phoneCode: "+971", currencyCode: "AED", currencySymbol: "AED", flag: "🇦🇪", isDefault: false, allowRegistration: true, taxRate: 5.0 },
    { name: "Singapore", code: "SG", phoneCode: "+65", currencyCode: "SGD", currencySymbol: "S$", flag: "🇸🇬", isDefault: false, allowRegistration: true, taxRate: 8.0 },
    { name: "Canada", code: "CA", phoneCode: "+1", currencyCode: "CAD", currencySymbol: "C$", flag: "🇨🇦", isDefault: false, allowRegistration: true, taxRate: 13.0 },
    { name: "Australia", code: "AU", phoneCode: "+61", currencyCode: "AUD", currencySymbol: "A$", flag: "🇦🇺", isDefault: false, allowRegistration: true, taxRate: 10.0 },
    { name: "Germany", code: "DE", phoneCode: "+49", currencyCode: "EUR", currencySymbol: "€", flag: "🇩🇪", isDefault: false, allowRegistration: true, taxRate: 19.0 },
    { name: "France", code: "FR", phoneCode: "+33", currencyCode: "EUR", currencySymbol: "€", flag: "🇫🇷", isDefault: false, allowRegistration: true, taxRate: 20.0 },
  ];

  for (const c of countries) {
    await prisma.country.upsert({
      where: { name: c.name },
      create: c,
      update: c,
    });
  }
  console.log(`✓ Seeded ${countries.length} Countries.`);
}

async function seedCurrencies() {
  console.log("Seeding Currencies...");
  const currencies = [
    { name: "Indian Rupee", code: "INR", symbol: "₹", isBase: true, isDefault: true, exchangeRate: 1.0, decimalPlaces: 2 },
    { name: "US Dollar", code: "USD", symbol: "$", isBase: false, isDefault: false, exchangeRate: 83.5, decimalPlaces: 2 },
    { name: "Euro", code: "EUR", symbol: "€", isBase: false, isDefault: false, exchangeRate: 90.2, decimalPlaces: 2 },
    { name: "British Pound", code: "GBP", symbol: "£", isBase: false, isDefault: false, exchangeRate: 105.4, decimalPlaces: 2 },
    { name: "UAE Dirham", code: "AED", symbol: "AED", isBase: false, isDefault: false, exchangeRate: 22.7, decimalPlaces: 2 },
    { name: "Singapore Dollar", code: "SGD", symbol: "S$", isBase: false, isDefault: false, exchangeRate: 61.8, decimalPlaces: 2 },
  ];

  for (const curr of currencies) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      create: curr,
      update: curr,
    });
  }
  console.log(`✓ Seeded ${currencies.length} Currencies.`);
}

async function seedLanguages() {
  console.log("Seeding Languages...");
  const languages = [
    "English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi",
    "Gujarati", "Kannada", "Malayalam", "Punjabi", "Spanish",
    "French", "German", "Arabic"
  ];

  for (const name of languages) {
    await prisma.language.upsert({
      where: { name },
      create: { name, status: "active" },
      update: { status: "active" },
    });
  }
  console.log(`✓ Seeded ${languages.length} Languages.`);
}

async function seedSkillCategories() {
  console.log("Seeding Skill Categories...");
  const categoryMap = new Map<string, string>(); // slug -> id

  for (const cat of SKILL_CATEGORIES) {
    const record = await prisma.skillCategory.upsert({
      where: { name: cat.name },
      create: {
        name: cat.name,
        sortOrder: cat.sortOrder || 0,
        status: "active",
      },
      update: {
        sortOrder: cat.sortOrder || 0,
        status: "active",
      },
    });
    categoryMap.set(cat.slug, record.id);
  }
  console.log(`✓ Seeded ${SKILL_CATEGORIES.length} Skill Categories.`);
  return categoryMap;
}

async function seedSkills(categoryMap: Map<string, string>) {
  console.log("Seeding Expanded Skills dataset...");
  let count = 0;
  const defaultCatId = categoryMap.values().next().value;

  for (const skill of RAW_SKILLS) {
    const categoryId = categoryMap.get(skill.categorySlug) || defaultCatId;
    if (!categoryId) continue;

    await prisma.skill.upsert({
      where: { name: skill.name },
      create: {
        name: skill.name,
        categoryId,
        status: "active",
      },
      update: {
        categoryId,
        status: "active",
      },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} normalized Skills.`);
}

async function seedTechnologies() {
  console.log("Seeding Technologies Catalog into MasterOptions...");
  let count = 0;
  for (const tech of RAW_TECHNOLOGIES) {
    const id = `tech_${tech.code.toLowerCase()}`;
    await prisma.masterOption.upsert({
      where: { id },
      create: {
        id,
        type: "technology",
        label: tech.name,
        value: tech.name,
        groupKey: tech.category,
        metadata: { slug: tech.slug, code: tech.code },
        status: "active",
      },
      update: {
        label: tech.name,
        value: tech.name,
        groupKey: tech.category,
        metadata: { slug: tech.slug, code: tech.code },
        status: "active",
      },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} Technologies into MasterOptions.`);
}

async function seedIndustries() {
  console.log("Seeding Expanded Industries...");
  for (const ind of RAW_INDUSTRIES) {
    await prisma.industry.upsert({
      where: { name: ind.name },
      create: {
        name: ind.name,
        status: "active",
      },
      update: {
        status: "active",
      },
    });
  }
  console.log(`✓ Seeded ${RAW_INDUSTRIES.length} Industries.`);
}

async function seedDesignations() {
  console.log("Seeding Expanded Designations into MasterOptions...");
  let count = 0;
  for (const des of RAW_DESIGNATIONS) {
    await prisma.masterOption.upsert({
      where: { id: `des_${des.code}` },
      create: {
        id: `des_${des.code}`,
        type: "designation",
        label: des.name,
        value: des.name,
        groupKey: des.category,
        metadata: { level: des.level, slug: des.slug, code: des.code },
        status: "active",
      },
      update: {
        label: des.name,
        value: des.name,
        groupKey: des.category,
        metadata: { level: des.level, slug: des.slug, code: des.code },
        status: "active",
      },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} Designations.`);
}

async function seedMasterOptions() {
  console.log("Seeding Expanded Master Options dataset...");
  let count = 0;
  for (const opt of RAW_MASTER_OPTIONS) {
    const id = `opt_${opt.type}_${opt.value.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    await prisma.masterOption.upsert({
      where: { id },
      create: {
        id,
        type: opt.type,
        label: opt.label,
        value: opt.value,
        min: opt.min,
        max: opt.max,
        groupKey: opt.groupKey,
        sortOrder: opt.sortOrder || 0,
        metadata: opt.metadata,
        status: "active",
      },
      update: {
        label: opt.label,
        value: opt.value,
        min: opt.min,
        max: opt.max,
        groupKey: opt.groupKey,
        sortOrder: opt.sortOrder || 0,
        metadata: opt.metadata,
        status: "active",
      },
    });
    count++;
  }
  console.log(`✓ Seeded ${count} Master Option items.`);
}

async function main() {
  console.log("===========================================");
  console.log("🚀 STARTING GO EXPERTS PHASE 2B MASTER EXPANSION");
  console.log("===========================================\n");

  try {
    await seedCountries();
    await seedCurrencies();
    await seedLanguages();
    const categoryMap = await seedSkillCategories();
    await seedSkills(categoryMap);
    await seedTechnologies();
    await seedIndustries();
    await seedDesignations();
    await seedMasterOptions();

    console.log("\n===========================================");
    console.log("✅ PHASE 2B MASTER EXPANSION SEED COMPLETED SUCCESSFULLY!");
    console.log("===========================================");
  } catch (err) {
    console.error("❌ Master Seed failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
