require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const targetId = 'eb3ae7d7-73f9-410d-973a-173b3dd1e2f2';
  console.log('Searching for ID:', targetId);

  const results = {};

  try { results.industry = await prisma.industry.findUnique({ where: { id: targetId } }); } catch (e) { console.log('industry err:', e.message); }
  try { results.skillCategory = await prisma.skillCategory.findUnique({ where: { id: targetId } }); } catch (e) { console.log('skillCategory err:', e.message); }
  try { results.skill = await prisma.skill.findUnique({ where: { id: targetId } }); } catch (e) { console.log('skill err:', e.message); }
  try { results.startupStage = await prisma.startupStage.findUnique({ where: { id: targetId } }); } catch (e) { console.log('startupStage err:', e.message); }
  try { results.experienceLevel = await prisma.experienceLevel.findUnique({ where: { id: targetId } }); } catch (e) { console.log('experienceLevel err:', e.message); }
  try { results.masterOption = await prisma.masterOption.findUnique({ where: { id: targetId } }); } catch (e) { console.log('masterOption err:', e.message); }
  try { results.country = await prisma.country.findUnique({ where: { id: targetId } }); } catch (e) { console.log('country err:', e.message); }

  console.log('SEARCH RESULTS:', JSON.stringify(results, null, 2));

  const allMasterOpts = await prisma.masterOption.findMany({ select: { id: true, type: true, label: true, value: true } });
  console.log('ALL MASTER OPTIONS COUNT:', allMasterOpts.length);
  console.log('ALL MASTER OPTIONS TYPES:', [...new Set(allMasterOpts.map(o => o.type))]);

  const matchingMasterOpt = allMasterOpts.find(o => o.id === targetId || o.value === targetId || o.label === targetId);
  console.log('MATCHING MASTER OPTION:', matchingMasterOpt);

  const allCategories = await prisma.skillCategory.findMany({ select: { id: true, name: true } });
  console.log('ALL SKILL CATEGORIES:', allCategories);

  const allIndustries = await prisma.industry.findMany({ select: { id: true, name: true } });
  console.log('ALL INDUSTRIES:', allIndustries);
}

main().finally(() => prisma.$disconnect());
