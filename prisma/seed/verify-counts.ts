import { prisma } from "../../src/config/database.js";

async function countAll() {
  const countries = await prisma.country.count();
  const currencies = await prisma.currency.count();
  const languages = await prisma.language.count();
  const skillCategories = await prisma.skillCategory.count();
  const skills = await prisma.skill.count();
  const industries = await prisma.industry.count();
  const masterOptions = await prisma.masterOption.count();
  
  const technologies = await prisma.masterOption.count({ where: { type: "technology" } });
  const designations = await prisma.masterOption.count({ where: { type: "designation" } });
  const companySizes = await prisma.masterOption.count({ where: { type: "company_size" } });
  const experienceLevels = await prisma.masterOption.count({ where: { type: "experience_level" } });
  const experienceRanges = await prisma.masterOption.count({ where: { type: "experience_range" } });
  const startupStages = await prisma.masterOption.count({ where: { type: "startup_stage" } });
  const fundingStages = await prisma.masterOption.count({ where: { type: "funding_stage" } });
  const startupGoals = await prisma.masterOption.count({ where: { type: "startup_goal" } });
  const investorTypes = await prisma.masterOption.count({ where: { type: "investor_type" } });
  const investmentTypes = await prisma.masterOption.count({ where: { type: "investment_type" } });
  const ticketSizes = await prisma.masterOption.count({ where: { type: "ticket_size" } });
  const founderTypes = await prisma.masterOption.count({ where: { type: "founder_type" } });
  const businessTypes = await prisma.masterOption.count({ where: { type: "business_type" } });
  const projectTypes = await prisma.masterOption.count({ where: { type: "project_type" } });
  const workModes = await prisma.masterOption.count({ where: { type: "work_mode" } });
  const availabilityOptions = await prisma.masterOption.count({ where: { type: "availability" } });
  const states = await prisma.masterOption.count({ where: { type: "state" } });
  const cities = await prisma.masterOption.count({ where: { type: "city" } });

  console.log("=== EXACT PHASE 2B DATABASE COUNTS ===");
  console.log(`Countries: ${countries}`);
  console.log(`Currencies: ${currencies}`);
  console.log(`Languages: ${languages}`);
  console.log(`Skill Categories: ${skillCategories}`);
  console.log(`Skills: ${skills}`);
  console.log(`Technologies Catalog: ${technologies}`);
  console.log(`Industries: ${industries}`);
  console.log(`Designations: ${designations}`);
  console.log(`Company Sizes: ${companySizes}`);
  console.log(`Experience Levels: ${experienceLevels}`);
  console.log(`Experience Ranges: ${experienceRanges}`);
  console.log(`Startup Stages: ${startupStages}`);
  console.log(`Funding Stages: ${fundingStages}`);
  console.log(`Startup Goals: ${startupGoals}`);
  console.log(`Investor Types: ${investorTypes}`);
  console.log(`Investment Types: ${investmentTypes}`);
  console.log(`Investment Ranges (Ticket Sizes): ${ticketSizes}`);
  console.log(`Founder Types: ${founderTypes}`);
  console.log(`Business Types: ${businessTypes}`);
  console.log(`Project Types: ${projectTypes}`);
  console.log(`Work Modes: ${workModes}`);
  console.log(`Availability Options: ${availabilityOptions}`);
  console.log(`India States & UTs: ${states}`);
  console.log(`India Commercial Cities: ${cities}`);
  console.log(`Total Master Options: ${masterOptions}`);

  await prisma.$disconnect();
}

countAll();
