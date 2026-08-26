import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const DEFAULT_BANNER = "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&h=400&fit=crop";
  const DEFAULT_LOGO = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces";

  // Update all freelancer profiles that don't have a banner
  const bannerUpdate = await prisma.freelancerProfile.updateMany({
    where: { bannerUrl: null },
    data: { bannerUrl: DEFAULT_BANNER },
  });

  // Update all freelancer profiles that don't have a logo
  const logoUpdate = await prisma.freelancerProfile.updateMany({
    where: { logoUrl: null },
    data: { logoUrl: DEFAULT_LOGO },
  });

  console.log(`Updated ${bannerUpdate.count} banners and ${logoUpdate.count} logos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
