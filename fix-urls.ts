import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing localhost URLs in the database...");
  
  // Fix Users
  const users = await prisma.user.findMany({
    where: {
      avatarUrl: { contains: "localhost:5001" }
    }
  });
  for (const u of users) {
    if (u.avatarUrl) {
      await prisma.user.update({
        where: { id: u.id },
        data: { avatarUrl: u.avatarUrl.replace("localhost:5001", "127.0.0.1:5001") }
      });
    }
  }

  // Fix FreelancerProfiles
  const freelancers = await prisma.freelancerProfile.findMany({
    where: {
      OR: [
        { logoUrl: { contains: "localhost:5001" } },
        { bannerUrl: { contains: "localhost:5001" } },
        { resumeUrl: { contains: "localhost:5001" } }
      ]
    }
  });
  for (const f of freelancers) {
    await prisma.freelancerProfile.update({
      where: { id: f.id },
      data: {
        logoUrl: f.logoUrl?.replace("localhost:5001", "127.0.0.1:5001"),
        bannerUrl: f.bannerUrl?.replace("localhost:5001", "127.0.0.1:5001"),
        resumeUrl: f.resumeUrl?.replace("localhost:5001", "127.0.0.1:5001"),
      }
    });
  }

  // Fix Advertisements
  const ads = await prisma.advertisement.findMany({
    where: { bannerUrl: { contains: "localhost:5001" } }
  });
  for (const a of ads) {
    await prisma.advertisement.update({
      where: { id: a.id },
      data: { bannerUrl: a.bannerUrl.replace("localhost:5001", "127.0.0.1:5001") }
    });
  }

  console.log(`Updated ${users.length} users, ${freelancers.length} freelancer profiles, ${ads.length} ads.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
