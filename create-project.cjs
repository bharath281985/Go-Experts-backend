const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { email: "teamgoexperts@gmail.com" } });
  if (user) {
    const newProject = await prisma.project.create({
      data: {
        title: "Build a React Native Mobile App",
        client: user.fullName || "Team GoExperts",
        budget: 5000,
        budgetMin: 3000,
        budgetMax: 7000,
        category: "Mobile Development",
        technology: "React Native",
        timeline: "2 months",
        description: "Looking for an expert to build a mobile app for our platform.",
        workMode: "remote",
        experienceLevel: "expert",
        status: "open"
      }
    });
    console.log("Created Project:", newProject);
  } else {
    console.log("User not found!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

