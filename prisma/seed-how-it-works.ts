/**
 * Seed: How It Works page data
 * Run: npx tsx prisma/seed-how-it-works.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding How It Works data...\n");

  // ─────────────────────────────────────
  // 1. WORKFLOW STEPS
  // ─────────────────────────────────────
  const workflowSteps = [
    // Freelancer
    { roleType: "freelancer", sortOrder: 1, title: "Create your account", description: "Sign up in under two minutes. Choose your skills, upload a portfolio sample and verify your identity.", contentJson: { outcome: "Verified profile ready to be discovered" } },
    { roleType: "freelancer", sortOrder: 2, title: "Build a standout profile", description: "Our AI profile builder analyses thousands of successful freelancers and surfaces exactly what to highlight to win projects.", contentJson: { outcome: "Top-10% visibility in your category" } },
    { roleType: "freelancer", sortOrder: 3, title: "Discover matching projects", description: "Our recommendation engine scores every project against your skills, rate expectations and working preferences — no scrolling required.", contentJson: { outcome: "Curated project feed, updated in real-time" } },
    { roleType: "freelancer", sortOrder: 4, title: "Connect with clients", description: "Send a focused proposal. Our templates are optimised for response rates. Chat, video-call and agree terms in one thread.", contentJson: { outcome: "Average first response in 4 hours" } },
    { roleType: "freelancer", sortOrder: 5, title: "Deliver & grow", description: "Use built-in milestone tracking, secure escrow payments and auto-generated invoices. Every completed project builds your reputation score.", contentJson: { outcome: "Steady income + growing public reputation" } },
    // Client
    { roleType: "client", sortOrder: 1, title: "Post your project", description: "Describe what you need in plain language. Our AI categorises it, suggests a budget range and writes a structured brief.", contentJson: { outcome: "Professional brief ready in minutes" } },
    { roleType: "client", sortOrder: 2, title: "Review matched talent", description: "Receive ranked freelancer suggestions within hours — scored on skill match, past performance and availability.", contentJson: { outcome: "Shortlist of qualified candidates" } },
    { roleType: "client", sortOrder: 3, title: "Interview & hire", description: "Video-call, review portfolios and check verified reviews. Send an offer with custom milestones directly in the platform.", contentJson: { outcome: "Contract signed, work starts immediately" } },
    { roleType: "client", sortOrder: 4, title: "Collaborate securely", description: "Share files, approve milestones and release payments from one dashboard. Your money sits in escrow until you're satisfied.", contentJson: { outcome: "Full visibility and zero payment risk" } },
    { roleType: "client", sortOrder: 5, title: "Rate & rehire", description: "Leave a review that helps the community. Save your favourite freelancers and rehire them in one click for future projects.", contentJson: { outcome: "A trusted talent network built over time" } },
    // Founder
    { roleType: "founder", sortOrder: 1, title: "Register your startup", description: "Submit your company profile, stage, sector and fundraising goals. Our team verifies you within 24 hours.", contentJson: { outcome: "Verified startup profile on the platform" } },
    { roleType: "founder", sortOrder: 2, title: "Browse co-founder talent", description: "Find technical, business or creative co-founders filtered by equity expectations, location and domain expertise.", contentJson: { outcome: "Matched co-founder candidates" } },
    { roleType: "founder", sortOrder: 3, title: "Connect with investors", description: "Pitch to our curated pool of 500+ verified investors. AI matching surfaces the right cheque-writers for your stage and sector.", contentJson: { outcome: "Warm introductions with aligned investors" } },
    { roleType: "founder", sortOrder: 4, title: "Build your team", description: "Hire expert freelancers across design, engineering, marketing and legal — all vetted, all available on flexible terms.", contentJson: { outcome: "Fully staffed team without full-time overhead" } },
    { roleType: "founder", sortOrder: 5, title: "Scale with resources", description: "Access Go Experts Office Hours, legal templates, investor update tools and community peer support.", contentJson: { outcome: "Faster growth with structured support" } },
    // Investor
    { roleType: "investor", sortOrder: 1, title: "Create your investor profile", description: "Define your thesis: stage, sector, cheque size and geography. Build a public profile that attracts inbound deal flow.", contentJson: { outcome: "Profile live and visible to 1,000+ founders" } },
    { roleType: "investor", sortOrder: 2, title: "Receive curated deal flow", description: "AI-matched startup opportunities arrive in your inbox weekly, aligned to your thesis. No cold pitches from off-target founders.", contentJson: { outcome: "Relevant deal flow without the noise" } },
    { roleType: "investor", sortOrder: 3, title: "Deep-dive on startups", description: "View verified traction data, team backgrounds, cap tables and documents — all in one due-diligence workspace.", contentJson: { outcome: "Informed decisions, faster due diligence" } },
    { roleType: "investor", sortOrder: 4, title: "Connect and negotiate", description: "Schedule calls, request additional data and collaborate on term sheets using our secure investor portal.", contentJson: { outcome: "Deal velocity with complete paper trail" } },
    { roleType: "investor", sortOrder: 5, title: "Track your portfolio", description: "Founders post monthly updates directly to your dashboard. Monitor KPIs, follow-on rounds and exits in real-time.", contentJson: { outcome: "Full portfolio visibility in one place" } },
  ];

  // Clear existing workflow steps
  await prisma.workflowStep.deleteMany({});
  console.log("  ✓ Cleared old workflow steps");

  for (const step of workflowSteps) {
    await prisma.workflowStep.create({
      data: {
        roleType: step.roleType,
        sortOrder: step.sortOrder,
        title: step.title,
        description: step.description,
        status: "published",
        icon: (step.contentJson as any)?.outcome ?? null,
      },
    });
  }
  console.log(`  ✓ Seeded ${workflowSteps.length} workflow steps`);

  // ─────────────────────────────────────
  // 2. CMS SECTIONS (hero, statistics, features, cta)
  // ─────────────────────────────────────
  await prisma.cmsHowItWorks.deleteMany({});
  console.log("  ✓ Cleared old CMS sections");

  const cmsSections = [
    // Hero - general
    { sectionName: "hero", roleType: "general", title: "One platform. Every professional journey.", subtitle: "Build, hire, invest & scale your business", description: "Whether you're freelancing, hiring, building a startup or investing — Go Experts gives you the tools, matching, and community to move fast.", buttonText: "Get started free", buttonLink: "/signup", sortOrder: 1, status: "published" },
    // Hero - role specific
    { sectionName: "hero", roleType: "freelancer", title: "Find your next great project.", subtitle: "Built for serious freelancers", description: "AI-matched projects, milestone payments, and a growing reputation — everything you need to build a thriving freelance career.", buttonText: "Start freelancing", buttonLink: "/signup/freelancer", sortOrder: 1, status: "published" },
    { sectionName: "hero", roleType: "client", title: "Hire expert talent, fast.", subtitle: "Built for businesses that deliver", description: "Post a project and receive ranked candidates within hours. Collaborate, approve milestones and pay securely — all in one place.", buttonText: "Post a project", buttonLink: "/signup/client", sortOrder: 1, status: "published" },
    { sectionName: "hero", roleType: "founder", title: "Build, fund and scale your startup.", subtitle: "Built for ambitious founders", description: "Connect with co-founders, raise from aligned investors, and hire expert talent — all from a single platform built for startup growth.", buttonText: "Register your startup", buttonLink: "/signup/founder", sortOrder: 1, status: "published" },
    { sectionName: "hero", roleType: "investor", title: "Discover your next great investment.", subtitle: "Built for active investors", description: "Curated deal flow, verified traction data, and a structured due diligence workspace. Invest smarter and faster.", buttonText: "Create investor profile", buttonLink: "/signup/investor", sortOrder: 1, status: "published" },
    // Statistics
    {
      sectionName: "statistics",
      roleType: null,
      title: "Platform Stats",
      subtitle: null,
      description: null,
      sortOrder: 1,
      status: "published",
      contentJson: [
        { value: "50K+", label: "Active Users" },
        { value: "10K+", label: "Projects Completed" },
        { value: "500+", label: "Verified Investors" },
        { value: "1,000+", label: "Startups Funded" },
      ],
    },
    // Features
    {
      sectionName: "features",
      roleType: null,
      title: "Platform Features",
      subtitle: null,
      description: null,
      sortOrder: 1,
      status: "published",
      contentJson: [
        { icon: "Zap", label: "AI Matching", description: "Precision-matched opportunities" },
        { icon: "Shield", label: "Secure Escrow", description: "Payment released on approval" },
        { icon: "MessageSquare", label: "Integrated Chat", description: "Messaging with file sharing" },
        { icon: "BarChart3", label: "Analytics", description: "Real-time performance data" },
        { icon: "FileText", label: "Smart Contracts", description: "Auto-generated legal docs" },
        { icon: "Video", label: "Video Calls", description: "Built-in interview tooling" },
      ],
    },
    // CTA - general
    { sectionName: "cta", roleType: "general", title: "Ready to get started?", description: "Join over 50,000 professionals who use Go Experts to work, hire, build and invest.", buttonText: "Get started free", buttonLink: "/signup", sortOrder: 1, status: "published" },
    { sectionName: "cta", roleType: "freelancer", title: "Ready to find your next project?", description: "Join 30,000+ freelancers already earning on Go Experts.", buttonText: "Start freelancing", buttonLink: "/signup/freelancer", sortOrder: 1, status: "published" },
    { sectionName: "cta", roleType: "client", title: "Ready to hire expert talent?", description: "Post your first project free and receive matched proposals within hours.", buttonText: "Post a project", buttonLink: "/signup/client", sortOrder: 1, status: "published" },
    { sectionName: "cta", roleType: "founder", title: "Ready to build your startup?", description: "Join 1,000+ founders who raised funding and built their teams on Go Experts.", buttonText: "Register your startup", buttonLink: "/signup/founder", sortOrder: 1, status: "published" },
    { sectionName: "cta", roleType: "investor", title: "Ready to discover your next deal?", description: "Join 500+ investors accessing curated deal flow on Go Experts.", buttonText: "Create investor profile", buttonLink: "/signup/investor", sortOrder: 1, status: "published" },
  ];

  for (const section of cmsSections) {
    await prisma.cmsHowItWorks.create({ data: section as any });
  }
  console.log(`  ✓ Seeded ${cmsSections.length} CMS sections`);

  // ─────────────────────────────────────
  // 3. FAQs (pageKey: how-it-works)
  // ─────────────────────────────────────
  await prisma.faq.deleteMany({ where: { pageKey: "how-it-works" } });
  console.log("  ✓ Cleared old how-it-works FAQs");

  const faqs = [
    { question: "How long does it take to get started?", answer: "You can create a verified profile in under 5 minutes. After that, our AI starts surfacing opportunities or candidates within the hour.", sortOrder: 1 },
    { question: "Is payment secure?", answer: "Yes. All project payments are held in escrow and only released once you approve the milestone. We support cards, bank transfers and UPI.", sortOrder: 2 },
    { question: "Can I switch roles — e.g. freelancer to founder?", answer: "Absolutely. You can manage multiple roles from one account. Your profiles stay separate but you use a single login.", sortOrder: 3 },
    { question: "How does the investor matching work?", answer: "Founders describe their stage, sector and raise size. Our model cross-references 500+ investor theses and surfaces high-probability matches, removing cold-pitch inefficiency.", sortOrder: 4 },
    { question: "What are the fees?", answer: "Freelancers pay a 5% platform fee on completed milestones. Clients pay nothing extra. Founders and investors access a flat monthly subscription.", sortOrder: 5 },
    { question: "Is my data private?", answer: "Yes. Go Experts is GDPR-compliant. Your personal data, portfolio and financial details are encrypted and never sold to third parties.", sortOrder: 6 },
    { question: "Do I need to be verified to use the platform?", answer: "Basic browsing is open. To apply for projects, post jobs or connect with investors, identity verification is required — it usually takes under 24 hours.", sortOrder: 7 },
  ];

  for (const faq of faqs) {
    await prisma.faq.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        pageKey: "how-it-works",
        sortOrder: faq.sortOrder,
        status: "PUBLISHED",
        featured: false,
        popular: false,
      },
    });
  }
  console.log(`  ✓ Seeded ${faqs.length} FAQs`);

  // ─────────────────────────────────────
  // 4. TESTIMONIALS (pageKey: how-it-works)
  // ─────────────────────────────────────
  await prisma.testimonial.deleteMany({ where: { pageKey: "how-it-works" } });
  console.log("  ✓ Cleared old how-it-works testimonials");

  const testimonials = [
    { name: "Arjun Mehta", role: "Full-Stack Developer", company: "Freelancer", content: "Within two weeks of completing my profile, I had three project offers. I've now earned over ₹8.5L on Go Experts this year.", rating: 5 },
    { name: "Deepak Sharma", role: "Managing Partner", company: "Horizon Capital", content: "We found our lead portfolio company through Go Experts' matched deal flow. The introduction saved us three months of networking.", rating: 5 },
    { name: "Priya Sharma", role: "Senior UX Designer", company: "Freelancer", content: "Go Experts matched me with a client who became a long-term partner. The platform just works — no noise, no wasted time.", rating: 5 },
    { name: "Amir Patel", role: "CTO", company: "ScaleFlow", content: "We hired our entire product team through Go Experts in 3 weeks. The quality was exceptional and the onboarding was seamless.", rating: 5 },
    { name: "Kavitha Reddy", role: "Founder", company: "NovaTech Labs", content: "Go Experts connected me with three investors who actually understood our SaaS model. We closed a ₹51L seed round in six weeks.", rating: 5 },
  ];

  for (const t of testimonials) {
    await prisma.testimonial.create({
      data: {
        name: t.name,
        role: t.role,
        company: t.company,
        content: t.content,
        rating: t.rating,
        pageKey: "how-it-works",
        status: "active",
      },
    });
  }
  console.log(`  ✓ Seeded ${testimonials.length} testimonials`);

  console.log("\n✅  How It Works seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
