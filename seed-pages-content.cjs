const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const termsHtmlContent = `<div class="space-y-8 font-sans leading-relaxed text-slate-700 dark:text-slate-300">
  <div class="border-b pb-4 mb-6">
    <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white">Terms & Conditions</h1>
    <p class="text-sm text-slate-500 mt-1">Last Updated: July 20, 2026 · Version 2.4</p>
  </div>

  <p class="text-lg text-slate-600 dark:text-slate-400">Welcome to Go Experts. These Terms and Conditions (“Terms”) govern your access to and use of the Go Experts platform, web portal, mobile application, and payment escrow services. By registering an account, you agree to be bound by these Terms.</p>

  <div class="space-y-6">
    <div class="border rounded-2xl p-6 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-3">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">01</span>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">User Accounts and Verification</h2>
      </div>
      <p class="text-sm">To access workspace tools, you must create a validated profile. You agree to provide accurate information. Go Experts reserves the right to suspend or block any profile failing identity checks, utilizing false names, or violating our verification requirements.</p>
    </div>

    <div class="border rounded-2xl p-6 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-3">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">02</span>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Milestone Escrow and Payments</h2>
      </div>
      <p class="text-sm mb-4">All contract agreements between clients and freelancers on the platform are secured through our milestone escrow protocol:</p>
      
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <p class="font-bold text-slate-900 dark:text-white mb-1">💼 1. Funding</p>
          <p class="text-slate-500">The client funds the milestone escrow beforehand. Work begins only after funds are verified.</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <p class="font-bold text-slate-900 dark:text-white mb-1">🔓 2. Release</p>
          <p class="text-slate-500">Funds are released to the freelancer upon client approval of the milestone deliverables.</p>
        </div>
        <div class="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800">
          <p class="font-bold text-slate-900 dark:text-white mb-1">⚖️ 3. Dispute</p>
          <p class="text-slate-500">If a dispute arises, funds remain locked until our support specialists issue a resolution.</p>
        </div>
      </div>
    </div>

    <!-- Alert / Warning block -->
    <div class="border-l-4 border-amber-500 bg-amber-500/5 p-6 rounded-r-2xl border border-y-slate-200/50 border-r-slate-200/50 dark:border-y-slate-800 dark:border-r-slate-800">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-amber-500 font-bold text-xs uppercase tracking-wider">⚠️ Important Circumvention Guard</span>
      </div>
      <h3 class="font-bold text-slate-900 dark:text-white mb-1">3. Non-Circumvention Clause</h3>
      <p class="text-sm text-slate-600 dark:text-slate-400">To protect platform integrity, all communication, contract creation, billing, and payments for client-freelancer connections made through Go Experts must occur exclusively within our application for a minimum of 24 months. Attempting to bypass platform escrow or process payments externally is a direct breach of these Terms and will result in permanent account suspension.</p>
    </div>

    <div class="border rounded-2xl p-6 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-3">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">04</span>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Intellectual Property</h2>
      </div>
      <p class="text-sm">Unless specified otherwise in a separate Statement of Work, the intellectual property rights for work delivered by a freelancer and fully paid for by a client are automatically transferred to the client upon the release of escrow funds.</p>
    </div>

    <div class="border rounded-2xl p-6 bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-3">
        <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">05</span>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Limitation of Liability</h2>
      </div>
      <p class="text-sm">Go Experts provides matching and payment escrow services. We do not assume responsibility for individual contractor output quality, investment results, or project delays. Users participate and collaborate at their own risk.</p>
    </div>
  </div>

  <div class="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
    <p class="font-bold text-slate-900 dark:text-white mb-1">Questions about our Terms?</p>
    <p class="text-sm text-slate-500 mb-4">Please reach out to our legal department for immediate help.</p>
    <a href="mailto:legal@goexperts.io" class="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors">Email Legal Team</a>
  </div>
</div>`;

const privacyHtmlContent = `<div class="space-y-8 font-sans leading-relaxed text-slate-700 dark:text-slate-300">
  <div class="border-b pb-4 mb-6">
    <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white">Privacy Policy</h1>
    <p class="text-sm text-slate-500 mt-1">Effective Date: July 20, 2026 · SOC2 Aligned</p>
  </div>

  <p class="text-lg text-slate-600 dark:text-slate-400">Go Experts (“we”, “us”, or “our”) is committed to protecting your privacy. This Privacy Policy describes how we collect, use, process, and disclose your personal information in connection with your access to and use of our platform.</p>

  <h2 class="text-2xl font-bold text-slate-900 dark:text-white">1. Information We Collect</h2>
  <p class="text-sm">To enable safe matches and secure billing, we collect information across these core categories:</p>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div class="border rounded-2xl p-5 bg-card hover:shadow-md transition-shadow">
      <h3 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">👤 Account Information</h3>
      <p class="text-xs text-slate-500 mt-2">Name, email, phone number, address, and verification details (such as tax IDs or business registration).</p>
    </div>
    <div class="border rounded-2xl p-5 bg-card hover:shadow-md transition-shadow">
      <h3 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">📂 Profile & Portfolio</h3>
      <p class="text-xs text-slate-500 mt-2">Skills, resume history, rates, business focus areas, pitch decks, and portfolio links.</p>
    </div>
    <div class="border rounded-2xl p-5 bg-card hover:shadow-md transition-shadow">
      <h3 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">💳 Secure Financials</h3>
      <p class="text-xs text-slate-500 mt-2">Bank routing/account numbers, billing address. Payment details are fully encrypted via Stripe/Razorpay.</p>
    </div>
    <div class="border rounded-2xl p-5 bg-card hover:shadow-md transition-shadow">
      <h3 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">🌐 Device & Usage</h3>
      <p class="text-xs text-slate-500 mt-2">IP addresses, browser types, interaction logs, and cookie identification to optimize page load speeds.</p>
    </div>
  </div>

  <div class="border rounded-2xl p-6 bg-card">
    <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-3">2. How We Use Your Information</h2>
    <ul class="space-y-2 text-sm">
      <li class="flex items-start gap-2">✓ To register your profile, verify identity, and maintain credentials.</li>
      <li class="flex items-start gap-2">✓ To facilitate matches between clients, freelancers, founders, and investors.</li>
      <li class="flex items-start gap-2">✓ To operate the secure milestone escrow transaction system.</li>
      <li class="flex items-start gap-2">✓ To prevent platform fraud, malicious activity, and off-platform contract breaches.</li>
    </ul>
  </div>

  <div class="border-l-4 border-emerald-500 bg-emerald-500/5 p-6 rounded-r-2xl border border-y-slate-200/50 border-r-slate-200/50 dark:border-y-slate-800 dark:border-r-slate-800">
    <h3 class="font-bold text-slate-900 dark:text-white mb-2">3. Your Rights and Preferences</h3>
    <p class="text-sm mb-4">You have complete control over how your data is handled. Depending on your region (e.g., GDPR, CCPA), you can contact us to:</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-center font-semibold">
      <div class="bg-card border rounded-xl p-3">Access & Export</div>
      <div class="bg-card border rounded-xl p-3">Update Details</div>
      <div class="bg-card border rounded-xl p-3 text-red-500">Request Deletion</div>
    </div>
  </div>

  <div class="text-center pt-4">
    <p class="text-sm text-slate-500">If you have any questions regarding this policy, please reach out to our privacy team at <strong>privacy@goexperts.io</strong>.</p>
  </div>
</div>`;

const refundHtmlContent = `<div class="space-y-8 font-sans leading-relaxed text-slate-700 dark:text-slate-300">
  <div class="border-b pb-4 mb-6">
    <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white">Refund Policy</h1>
    <p class="text-sm text-slate-500 mt-1">Last Updated: June 1, 2026 · Fair Refund Protocol</p>
  </div>

  <p class="text-lg text-slate-600 dark:text-slate-400">This Refund Policy explains when Go Experts issues refunds for subscriptions, wallet deposits, and escrow milestone contracts.</p>

  <div class="space-y-4">
    <div class="border rounded-2xl p-6 bg-card hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="h-7 w-7 rounded bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm">1</div>
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Subscriptions</h2>
      </div>
      <p class="text-sm text-slate-500">Subscription fees are generally non-refundable once a billing period has started. Accidental duplicate charges may be refunded within 7 days when reported to billing@goexperts.io.</p>
    </div>

    <div class="border rounded-2xl p-6 bg-card hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="h-7 w-7 rounded bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm">2</div>
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Wallet deposits</h2>
      </div>
      <p class="text-sm text-slate-500">Unused wallet balances may be withdrawn to a verified payout method subject to KYC checks and gateway fees. Deposits already reserved in escrow for active contracts are not eligible for withdrawal.</p>
    </div>

    <div class="border rounded-2xl p-6 bg-card hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-2">
        <div class="h-7 w-7 rounded bg-red-500/10 text-red-600 flex items-center justify-center font-bold text-sm">3</div>
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">Escrow & milestone payments</h2>
      </div>
      <p class="text-sm text-slate-500">Funds held in escrow are released per milestone approvals. If a client and freelancer cannot agree on deliverables, either party may open a dispute to begin our structured arbitration process.</p>
    </div>
  </div>

  <div class="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-center">
    <h3 class="font-bold text-slate-900 dark:text-white mb-2">How to Request a Refund</h3>
    <p class="text-sm text-slate-500 mb-3">Email billing@goexperts.io with your account email, invoice or transaction ID, and reason. We typically respond within 3 business days.</p>
  </div>
</div>`;

async function updatePageByName(name, content, category) {
  const page = await prisma.cmsPage.findFirst({
    where: { name }
  });

  if (page) {
    await prisma.cmsPage.update({
      where: { id: page.id },
      data: { content, items: 1, updated: "2026-07-20" }
    });
    console.log(`✓ Updated "${name}" page.`);
  } else {
    await prisma.cmsPage.create({
      data: {
        name,
        category,
        content,
        items: 1,
        updated: "2026-07-20",
        status: "active"
      }
    });
    console.log(`✓ Created "${name}" page.`);
  }
}

async function main() {
  console.log("Updating dynamic footer pages content...");

  await updatePageByName("Legal", termsHtmlContent, "Legal");
  await updatePageByName("Privacy", privacyHtmlContent, "Legal");
  await updatePageByName("Refund Policy", refundHtmlContent, "Legal");

  console.log("Database dynamic seeding complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
