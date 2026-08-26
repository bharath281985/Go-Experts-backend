const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ 
      where: { onboardingCompleted: true },
      select: { email: true, role: true } 
    });
    console.log("Users found:", users.length);
    const roles = ['client', 'founder', 'freelancer', 'investor'];
    const result = {};
    for (const role of roles) {
      result[role] = users.filter(u => u.role === role).slice(0, 3).map(u => u.email);
    }
    fs.writeFileSync('onboarded_users.json', JSON.stringify(result, null, 2));
    console.log("Wrote to onboarded_users.json");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
