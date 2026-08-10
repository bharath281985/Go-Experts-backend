import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  const policies = [
    { name: 'Privacy', title: 'Privacy Policy', subtitle: 'Learn how Go Experts collects, uses and protects your personal information.' },
    { name: 'Legal', title: 'Terms & Conditions', subtitle: 'Please read our terms and conditions carefully.' },
    { name: 'Refund Policy', title: 'Refund Policy', subtitle: 'Our policies regarding refunds and cancellations.' }
  ];

  for (const policy of policies) {
    const row = await prisma.cmsPage.findFirst({ where: { name: policy.name } });
    if (!row) {
      console.log(`Skipping ${policy.name}, not found.`);
      continue;
    }
    
    // If it's already structured, skip
    if (row.content && row.content.trim().startsWith('{')) {
      console.log(`Skipping ${policy.name}, already structured JSON.`);
      continue;
    }

    const newJson = {
      title: policy.title,
      subtitle: policy.subtitle,
      version: "1.0",
      effectiveDate: "August 1, 2026",
      lastUpdated: new Date().toISOString().split('T')[0],
      contactEmail: "support@goexperts.in",
      contactUrl: "/contact",
      summary: null,
      sections: [
        {
          id: "full-policy",
          title: "Policy Details",
          content: row.content || "<p>No content available.</p>"
        }
      ],
      seo: {
        metaTitle: policy.title,
        metaDescription: policy.subtitle
      }
    };

    const payloadStr = JSON.stringify(newJson);

    await prisma.cmsPage.update({
      where: { id: row.id },
      data: {
        draftJson: payloadStr,
        publishedJson: payloadStr,
        content: payloadStr
      }
    });

    console.log(`Migrated ${policy.name} to new JSON structure!`);
  }
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
