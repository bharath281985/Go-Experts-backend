import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Help Center...");

  // 1. Create Default Help Center Page Settings
  const settings = {
    heroEyebrow: "GO EXPERTS HELP CENTER",
    heroTitle: "How can we help you?",
    heroHighlighted: "help you",
    heroDescription: "Find answers, guides and step-by-step solutions for everything in Go Experts.",
    searchPlaceholder: "Search for articles, guides and FAQs...",
    searchSupporting: "Popular: Profile Setup · Payments · Projects · Security",
    popularSearches: "Profile Setup, Payments, Projects, Security",
    backgroundStyle: "mesh",
    heroMedia: "",
    heroMediaAlt: "",
    heroEnabled: true
  };

  await prisma.cmsPage.upsert({
    where: { name: "Help Center" },
    update: {
      content: JSON.stringify(settings),
      status: "active",
      category: "Help Center"
    },
    create: {
      name: "Help Center",
      category: "Help Center",
      status: "active",
      content: JSON.stringify(settings)
    }
  });

  // 2. Clear old data to prevent conflicts
  await prisma.helpVideoGuide.deleteMany({});
  await prisma.helpArticle.deleteMany({});
  await prisma.faq.deleteMany({ where: { categoryId: { not: null } } });
  await prisma.helpCategory.deleteMany({});

  // 3. Create Categories
  const cat1 = await prisma.helpCategory.create({
    data: {
      name: "Account & Profile",
      slug: "account-profile",
      icon: "User",
      shortDescription: "Manage settings, profile visibility, verification and login details.",
      order: 1,
      enabled: true
    }
  });

  const cat2 = await prisma.helpCategory.create({
    data: {
      name: "Billing & Payments",
      slug: "billing-payments",
      icon: "CreditCard",
      shortDescription: "Understand fees, payouts, payment milestones and invoice processing.",
      order: 2,
      enabled: true
    }
  });

  const cat3 = await prisma.helpCategory.create({
    data: {
      name: "Projects & Bidding",
      slug: "projects-bidding",
      icon: "Briefcase",
      shortDescription: "Learn how to bid, hire freelancers, submit proposals and manage tasks.",
      order: 3,
      enabled: true
    }
  });

  const cat4 = await prisma.helpCategory.create({
    data: {
      name: "Trust & Safety",
      slug: "trust-safety",
      icon: "ShieldCheck",
      shortDescription: "Terms of service, escrow protection, dispute center and system policies.",
      order: 4,
      enabled: true
    }
  });

  // 4. Create Articles
  await prisma.helpArticle.create({
    data: {
      categoryId: cat1.id,
      title: "How to complete your freelancer profile",
      slug: "complete-freelancer-profile",
      excerpt: "Learn how to present your skills, portfolio projects, and rate to clients effectively.",
      content: `<h2>Step-by-Step Profile Guide</h2><p>Your freelancer profile is your digital handshake on Go Experts. Follow these steps to optimize it for high-paying contracts:</p><ul><li><strong>Add a professional photo:</strong> Clear headshot with clean background.</li><li><strong>Write a compelling bio:</strong> Highlight your core industries and technologies.</li><li><strong>Upload portfolio items:</strong> Add high-resolution images and clear case studies.</li><li><strong>Set an accurate hourly rate:</strong> Research market averages for your experience level.</li></ul>`,
      articleType: "Article",
      featured: true,
      popular: true,
      status: "published",
      order: 1,
      seoTitle: "Optimize Your Go Experts Freelancer Profile",
      seoDescription: "Get hired faster by completing all parts of your freelancer portfolio and profile details."
    }
  });

  await prisma.helpArticle.create({
    data: {
      categoryId: cat1.id,
      title: "Understanding Account Verification",
      slug: "account-verification-steps",
      excerpt: "Find out how the verification badge works and what documents are required.",
      content: `<h2>Account Verification Process</h2><p>Go Experts enforces verification badges to maintain platform integrity. Here is what we look for:</p><ol><li>Government Issued Identification.</li><li>Proof of professional experience (linked GitHub/LinkedIn).</li><li>A 2-minute live camera face check.</li></ol>`,
      articleType: "Guide",
      featured: false,
      popular: true,
      status: "published",
      order: 2
    }
  });

  await prisma.helpArticle.create({
    data: {
      categoryId: cat2.id,
      title: "Understanding Escrow & Payment Milestones",
      slug: "escrow-payment-milestones",
      excerpt: "Learn how escrow accounts protect both clients and freelancers during contract cycles.",
      content: `<h2>How Escrow Protects You</h2><p>Payments on Go Experts are milestone-based and handled securely via Escrow:</p><ul><li><strong>Client funds milestone:</strong> Money is locked in escrow before work begins.</li><li><strong>Freelancer submits work:</strong> Files and logs are attached for review.</li><li><strong>Client releases payment:</strong> Funds are paid directly into the freelancer's wallet.</li></ul>`,
      articleType: "Article",
      featured: true,
      popular: true,
      status: "published",
      order: 1
    }
  });

  await prisma.helpArticle.create({
    data: {
      categoryId: cat3.id,
      title: "How to Bid on Projects Successfully",
      slug: "bid-on-projects-successfully",
      excerpt: "Expert advice on structuring proposals, submitting bids, and negotiating terms.",
      content: `<h2>Write Winning Proposals</h2><p>Clients receive dozens of bids. Stand out with these three simple hacks:</p><ol><li>Never copy-paste templates; address the prompt details directly.</li><li>Propose a clear breakdown of milestones.</li><li>Link directly to relevant previous work.</li></ol>`,
      articleType: "Article",
      featured: false,
      popular: true,
      status: "published",
      order: 1
    }
  });

  // 5. Create Video Guides
  await prisma.helpVideoGuide.create({
    data: {
      categoryId: cat1.id,
      title: "Creating a Premium Freelancer Portfolio",
      description: "A complete visual walkthrough of building your portfolio showcase.",
      thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: "3:42",
      order: 1,
      enabled: true
    }
  });

  await prisma.helpVideoGuide.create({
    data: {
      categoryId: cat2.id,
      title: "Withdrawing Funds and Setting Up Payouts",
      description: "Quick tutorial showing how to link bank accounts and request payouts.",
      thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80",
      videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
      duration: "2:15",
      order: 2,
      enabled: true
    }
  });

  // 6. Create FAQs
  await prisma.faq.create({
    data: {
      categoryId: cat1.id,
      question: "How do I update my profile details?",
      answer: "Go to your Account Settings page, update your profile inputs, and click Save Changes. Verified badges may take 24 hours to re-approve.",
      category: "Account & Profile",
      status: "active"
    }
  });

  await prisma.faq.create({
    data: {
      categoryId: cat2.id,
      question: "How are platform processing fees calculated?",
      answer: "We charge a standard 5% platform fee on all successfully funded contracts. There are no hidden setup fees.",
      category: "Billing & Payments",
      status: "active"
    }
  });

  await prisma.faq.create({
    data: {
      categoryId: cat4.id,
      question: "How does escrow protection protect my payments?",
      answer: "Escrow secures the client's money before the milestone work starts, assuring the freelancer that they will get paid upon successful completion of the milestones.",
      category: "Trust & Safety",
      status: "active"
    }
  });

  console.log("Help Center Seeded Successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
