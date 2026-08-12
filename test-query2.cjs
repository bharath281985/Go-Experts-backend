const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cat = await prisma.category.findUnique({where: {id: '7344b40a-950c-4e65-894c-5f9582389b85'}});
  console.log('Category:', cat);

  // let's try to query all other tables that might contain this UUID
  // like SubCategory, Tag, anything?
  
  const cats = await prisma.category.findMany();
  console.log('Categories:', cats.length);
}

main().finally(() => prisma.$disconnect());
