const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const templates = await prisma.resumeTemplate.findMany();
  for (const t of templates) {
    const color = t.key === 'creative' ? 'ec4899/ffffff' : t.key === 'modern' ? '3b82f6/ffffff' : t.key === 'ats-optimized' ? 'ffffff/0f172a' : t.key === 'developer' ? '0f172a/22c55e' : 'ffffff/334155';
    const url = `https://placehold.co/420x594/${color}?text=${encodeURIComponent(t.name)}%20Resume`;
    await prisma.resumeTemplate.update({ where: { id: t.id }, data: { thumbnail: url } });
  }
  console.log('Updated all thumbnails!');
}

run();
