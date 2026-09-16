import { prisma } from '../config/database.js';

async function main() {
  const setting = await prisma.setting.findUnique({
    where: { key: 'settings:section:email_templates' }
  });

  if (!setting) {
    console.log('Not found');
    return;
  }
  const templates = JSON.parse(setting.value);
  const tpl = templates.find((t: any) => t.id === 'tpl_verification_link');
  console.log("HTML:", tpl.html);
}

main().finally(() => prisma.$disconnect());
