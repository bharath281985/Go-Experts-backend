const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const defaultAnswer = "Please refer to our comprehensive knowledge base and support documentation for detailed instructions. You may also contact our support team via the in-app chat.";

const questions = [
  "Platform FAQ #99: How to manage notifications?",
  "Platform FAQ #47: How to manage billing?",
  "How do I upgrade my subscription plan?",
  "Platform FAQ #142: How to manage projects?",
  "Platform FAQ #94: How to manage KYC?",
  "Platform FAQ #17: How to manage billing?",
  "Platform FAQ #135: How to manage notifications?",
  "Platform FAQ #91: How to manage KYC?",
  "Platform FAQ #113: How to manage projects?",
  "Platform FAQ #119: How to manage subscriptions?",
  "What payment gateways are supported?",
  "Platform FAQ #115: How to manage subscriptions?",
  "Platform FAQ #62: How to manage billing?",
  "Platform FAQ #126: How to manage billing?",
  "Platform FAQ #85: How to manage notifications?",
  "Platform FAQ #31: How to manage projects?",
  "Platform FAQ #81: How to manage projects?",
  "What is the refund policy?",
  "Platform FAQ #51: How to manage projects?",
  "Platform FAQ #118: How to manage notifications?",
  "Platform FAQ #45: How to manage notifications?",
  "Platform FAQ #57: How to manage KYC?",
  "Platform FAQ #136: How to manage billing?",
  "Platform FAQ #103: How to manage KYC?",
  "Platform FAQ #59: How to manage billing?",
  "Platform FAQ #15: How to manage notifications?",
  "Platform FAQ #129: How to manage projects?",
  "Platform FAQ #43: How to manage billing?",
  "Platform FAQ #14: How to manage projects?",
  "Platform FAQ #73: How to manage subscriptions?",
  "Platform FAQ #26: How to manage notifications?",
  "Platform FAQ #50: How to manage notifications?",
  "Platform FAQ #23: How to manage projects?",
  "Platform FAQ #149: How to manage billing?",
  "Platform FAQ #111: How to manage notifications?",
  "Platform FAQ #18: How to manage notifications?",
  "Platform FAQ #13: How to manage billing?",
  "Platform FAQ #24: How to manage notifications?",
  "Platform FAQ #65: How to manage KYC?",
  "Platform FAQ #106: How to manage subscriptions?",
  "Platform FAQ #40: How to manage notifications?",
  "How are freelancer ratings calculated?",
  "Platform FAQ #11: How to manage billing?",
  "Platform FAQ #33: How to manage billing?",
  "Platform FAQ #87: How to manage subscriptions?",
  "Platform FAQ #74: How to manage billing?",
  "Platform FAQ #122: How to manage KYC?",
  "Platform FAQ #104: How to manage KYC?",
  "Platform FAQ #120: How to manage notifications?",
  "Platform FAQ #36: How to manage KYC?"
];

function getCategory(q) {
  const lower = q.toLowerCase();
  if (lower.includes("billing") || lower.includes("gateway") || lower.includes("payment")) return "Payments";
  if (lower.includes("subscription") || lower.includes("plan")) return "Subscriptions";
  if (lower.includes("project")) return "Projects";
  if (lower.includes("kyc")) return "KYC";
  if (lower.includes("notification")) return "Notifications";
  return "General";
}

async function main() {
  console.log("Seeding faqs table with 50 questions...");

  // Delete all existing FAQs from the faqs table to perform a clean seed
  await prisma.faq.deleteMany({});
  console.log("✓ Cleared existing FAQs.");

  // Insert all new FAQs
  for (const q of questions) {
    await prisma.faq.create({
      data: {
        question: q,
        answer: defaultAnswer,
        category: getCategory(q),
        status: "active"
      }
    });
  }
  console.log(`✓ Inserted ${questions.length} FAQs into 'faqs' table.`);

  // Build a beautiful HTML accordion list for the dynamic CMS page content
  let faqListHtml = `
<div class="space-y-6 font-sans leading-relaxed text-slate-700 dark:text-slate-300">
  <div class="border-b pb-4 mb-6">
    <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h1>
    <p class="text-sm text-slate-500 mt-1">Quick answers to what our community asks most.</p>
  </div>

  <div class="space-y-4">
  `;

  questions.forEach((q, i) => {
    faqListHtml += `
    <div class="${i > 0 ? 'border-t pt-4' : ''}">
      <h3 class="font-bold text-slate-950 dark:text-white flex items-start gap-2">
        <span class="text-primary text-xs bg-primary/10 px-2 py-0.5 rounded mt-0.5">Q</span>
        ${q}
      </h3>
      <p class="text-sm text-slate-500 mt-2 pl-7">${defaultAnswer}</p>
    </div>
    `;
  });

  faqListHtml += `
  </div>
</div>
  `;

  // Update dynamic CMS FAQ Page with this complete beautiful content list
  const cmsPage = await prisma.cmsPage.findFirst({
    where: { name: "FAQ" }
  });

  if (cmsPage) {
    await prisma.cmsPage.update({
      where: { id: cmsPage.id },
      data: {
        content: faqListHtml,
        items: questions.length,
        updated: "2026-07-20"
      }
    });
    console.log("✓ Successfully updated dynamic 'FAQ' CMS page in database.");
  } else {
    await prisma.cmsPage.create({
      data: {
        name: "FAQ",
        category: "Legal",
        content: faqListHtml,
        items: questions.length,
        updated: "2026-07-20",
        status: "active"
      }
    });
    console.log("✓ Successfully created and seeded dynamic 'FAQ' CMS page.");
  }

  console.log("FAQ Seeding Completed Successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
