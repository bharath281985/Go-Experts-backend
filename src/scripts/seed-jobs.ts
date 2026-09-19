import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding job data...");

  // Ensure an engineering department exists
  let dept = await prisma.department.findFirst({
    where: { name: "Engineering" }
  });

  if (!dept) {
    dept = await prisma.department.create({
      data: {
        id: uuidv4(),
        name: "Engineering",
        slug: "engineering"
      }
    });
    console.log("Created Engineering department");
  }

  // Seed Senior Frontend Engineer
  const frontendSlug = "senior-frontend-engineer-" + Math.random().toString(36).substring(7);
  await prisma.jobOpening.create({
    data: {
      id: uuidv4(),
      title: "Senior Frontend Engineer",
      jobCode: "ENG-FE-001",
      department: "Engineering",
      departmentId: dept.id,
      slug: frontendSlug,
      location: "Remote (Global)",
      workplaceType: "remote",
      employmentType: "full_time",
      experienceLevel: "senior",
      minExperience: 5,
      openings: 2,
      salaryMin: 1500000,
      salaryMax: 2500000,
      currency: "INR",
      salaryVisibility: true,
      shortSummary: "We are looking for a highly skilled Senior Frontend Engineer to build robust SaaS applications using React.",
      fullDescription: "As a Senior Frontend Engineer at Go Experts, you will architect our main applications...",
      status: "published",
      featured: true,
    }
  });

  // Seed Product Designer
  const designSlug = "product-designer-design-systems-" + Math.random().toString(36).substring(7);
  await prisma.jobOpening.create({
    data: {
      id: uuidv4(),
      title: "Product Designer (Design Systems)",
      jobCode: "DES-PD-002",
      department: "Design",
      slug: designSlug,
      location: "Remote (Global)",
      workplaceType: "remote",
      employmentType: "full_time",
      experienceLevel: "mid",
      minExperience: 3,
      openings: 1,
      salaryMin: 1200000,
      salaryMax: 2000000,
      currency: "INR",
      salaryVisibility: true,
      shortSummary: "Join our design team to build out the Go Experts design system and core product experience.",
      fullDescription: "We need someone with strong Figma skills...",
      status: "published",
      featured: true,
    }
  });

  console.log("Job data seeded successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
