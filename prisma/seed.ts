import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function rndFloat(min: number, max: number) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function addMonths(d: Date, months: number): Date {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd;
}
function uuid(): string {
  return crypto.randomUUID();
}

async function main() {
  console.log("🌱 Starting Go Experts Financial Seed...\n");

  console.log("Cleaning database tables...");
  const deleteTable = async (model: any) => {
    try {
      if (model) await model.deleteMany({});
    } catch (err) {
      // Ignore if table is not yet created or clean
    }
  };

  // Delete children first, then parents to respect foreign keys
  await deleteTable((prisma as any).activityLog);
  await deleteTable((prisma as any).auditLog);
  await deleteTable((prisma as any).apiRequestLog);
  await deleteTable((prisma as any).loginAttempt);
  await deleteTable((prisma as any).systemAlert);
  
  await deleteTable((prisma as any).notificationDeliveryAttempt);
  await deleteTable((prisma as any).notificationQueue);
  await deleteTable((prisma as any).notificationLog);
  await deleteTable((prisma as any).notificationCampaign);
  await deleteTable((prisma as any).notification);
  await deleteTable((prisma as any).notificationPreference);
  await deleteTable((prisma as any).deviceToken);
  await deleteTable((prisma as any).notificationTemplate);
  await deleteTable((prisma as any).communicationChannel);

  await deleteTable((prisma as any).supportTicket);
  await deleteTable((prisma as any).review);
  await deleteTable((prisma as any).proposal);
  await deleteTable((prisma as any).taskChecklist);
  await deleteTable((prisma as any).task);
  await deleteTable((prisma as any).milestone);
  await deleteTable((prisma as any).timeLog);
  await deleteTable((prisma as any).project);
  await deleteTable((prisma as any).referralReward);
  await deleteTable((prisma as any).referral);
  await deleteTable((prisma as any).featuredService);
  await deleteTable((prisma as any).advertisement);
  await deleteTable((prisma as any).advertisementPlan);
  await deleteTable((prisma as any).couponUsage);
  await deleteTable((prisma as any).coupon);

  await deleteTable((prisma as any).invoiceItem);
  await deleteTable((prisma as any).invoice);
  await deleteTable((prisma as any).paymentRefund);
  await deleteTable((prisma as any).payment);
  await deleteTable((prisma as any).walletTransaction);
  await deleteTable((prisma as any).walletBonus);
  await deleteTable((prisma as any).walletReward);
  await deleteTable((prisma as any).wallet);

  await deleteTable((prisma as any).subscriptionTransaction);
  await deleteTable((prisma as any).subscriptionHistory);
  await deleteTable((prisma as any).subscriptionUsage);
  await deleteTable((prisma as any).subscriptionFeature);
  await deleteTable((prisma as any).subscription);
  await deleteTable((prisma as any).subscriptionPlan);

  await deleteTable((prisma as any).freelancerProfile);
  await deleteTable((prisma as any).clientProfile);
  await deleteTable((prisma as any).investorProfile);
  await deleteTable((prisma as any).founderProfile);
  await deleteTable((prisma as any).meeting);
  await deleteTable((prisma as any).investment);
  await deleteTable((prisma as any).startupIdea);
  await deleteTable((prisma as any).message);
  await deleteTable((prisma as any).conversation);
  await deleteTable((prisma as any).user);

  await deleteTable((prisma as any).adminUser);
  await deleteTable((prisma as any).rolePermission);
  await deleteTable((prisma as any).permission);
  await deleteTable((prisma as any).role);

  await deleteTable((prisma as any).country);
  await deleteTable((prisma as any).industry);
  await deleteTable((prisma as any).skill);
  await deleteTable((prisma as any).currency);
  await deleteTable((prisma as any).language);
  await deleteTable((prisma as any).startupStage);
  await deleteTable((prisma as any).fundingType);
  await deleteTable((prisma as any).workMode);
  await deleteTable((prisma as any).experienceLevel);
  await deleteTable((prisma as any).cmsPage);
  console.log("Database tables cleaned successfully.");

  // ─────────────────────────────────────────
  // 1. ROLES & ADMIN USER
  // ─────────────────────────────────────────
  console.log("Creating roles...");
  const superRole = await prisma.role.upsert({
    where: { name: "Super Admin" },
    update: {},
    create: { name: "Super Admin", description: "Full system access" },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: { name: "Admin", description: "Standard admin access" },
  });

  const modRole = await prisma.role.upsert({
    where: { name: "Moderator" },
    update: {},
    create: { name: "Moderator", description: "Content moderation access" },
  });

  console.log("Creating permissions...");
  const permissionDefs = [
    { module: "users", action: "view" },
    { module: "users", action: "create" },
    { module: "users", action: "edit" },
    { module: "users", action: "delete" },
    { module: "projects", action: "view" },
    { module: "projects", action: "create" },
    { module: "projects", action: "edit" },
    { module: "projects", action: "approve" },
    { module: "payments", action: "view" },
    { module: "payments", action: "refund" },
    { module: "content", action: "view" },
    { module: "content", action: "edit" },
    { module: "settings", action: "view" },
    { module: "settings", action: "edit" },
    { module: "support", action: "view" },
    { module: "support", action: "edit" },
    { module: "analytics", action: "view" },
    { module: "roles", action: "view" },
    { module: "roles", action: "edit" },
  ];
  const permissionRows = [];
  for (const p of permissionDefs) {
    const row = await prisma.permission.upsert({
      where: { action_module: { action: p.action, module: p.module } },
      update: {},
      create: { action: p.action, module: p.module, description: `${p.action} ${p.module}` },
    });
    permissionRows.push(row);
  }
  for (const permission of permissionRows) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: superRole.id, permissionId: permission.id },
    });
  }

  console.log("Creating admin users...");
  const hashedPw = await bcrypt.hash("Admin@123", 12);
  await prisma.adminUser.upsert({
    where: { email: "superadmin@goexperts.com" },
    update: {},
    create: {
      email: "superadmin@goexperts.com",
      password: hashedPw,
      fullName: "Super Administrator",
      roleId: superRole.id,
    },
  });

  // ─────────────────────────────────────────
  // 2. MASTER DATA
  // ─────────────────────────────────────────
  console.log("Creating master data...");

  const industryNames = ["Technology", "Finance", "Healthcare", "Education", "E-Commerce", "Real Estate", "Manufacturing", "Marketing", "Legal", "Consulting"];
  const industries: any[] = [];
  for (const name of industryNames) {
    const ind = await prisma.industry.upsert({ where: { name }, update: {}, create: { name } });
    industries.push(ind);
  }

  const skillDefs = [
    { name: "React", industry: "Technology" },
    { name: "Node.js", industry: "Technology" },
    { name: "TypeScript", industry: "Technology" },
    { name: "Flutter", industry: "Technology" },
    { name: "Python", industry: "Technology" },
    { name: "Machine Learning", industry: "Technology" },
    { name: "Data Science", industry: "Technology" },
    { name: "DevOps", industry: "Technology" },
    { name: "Blockchain", industry: "Finance" },
    { name: "UI/UX Design", industry: "Marketing" },
  ];
  const skills: any[] = [];
  for (const skill of skillDefs) {
    const s = await prisma.skill.upsert({
      where: { name: skill.name },
      update: { industry: skill.industry },
      create: { name: skill.name, industry: skill.industry },
    });
    skills.push(s);
  }

  const countryNames = ["India", "USA", "UK", "Canada", "Australia", "Germany", "UAE", "Singapore", "France", "Japan"];
  const countries: any[] = [];
  for (const name of countryNames) {
  const c = await prisma.country.upsert({ where: { name }, update: {}, create: { name } });
    countries.push(c);
  }

  // ─────────────────────────────────────────
  // 3. SUBSCRIPTION PLANS (10 plans)
  // ─────────────────────────────────────────
  console.log("Creating 10 subscription plans...");

  const planDefs = [
    // Freelancer plans
    { name: "Freelancer Starter", role: "freelancer", amount: 299, duration: "monthly", popular: false, recommended: false,
      limits: { proposals: 5, projects: 2, featured: false } },
    { name: "Freelancer Pro", role: "freelancer", amount: 799, duration: "monthly", popular: true, recommended: true,
      limits: { proposals: 30, projects: 10, featured: true } },
    { name: "Freelancer Elite", role: "freelancer", amount: 1499, duration: "monthly", popular: false, recommended: false,
      limits: { proposals: -1, projects: -1, featured: true } },
    { name: "Freelancer Annual", role: "freelancer", amount: 5999, duration: "yearly", popular: false, recommended: false,
      limits: { proposals: -1, projects: -1, featured: true } },
    // Client plans
    { name: "Client Basic", role: "client", amount: 499, duration: "monthly", popular: false, recommended: false,
      limits: { jobs: 3, shortlists: 10 } },
    { name: "Client Business", role: "client", amount: 1999, duration: "monthly", popular: true, recommended: true,
      limits: { jobs: 20, shortlists: -1 } },
    { name: "Client Enterprise", role: "client", amount: 4999, duration: "monthly", popular: false, recommended: false,
      limits: { jobs: -1, shortlists: -1 } },
    // Investor plans
    { name: "Investor Basic", role: "investor", amount: 999, duration: "monthly", popular: false, recommended: false,
      limits: { dealflow: 5 } },
    { name: "Investor Premium", role: "investor", amount: 2999, duration: "quarterly", popular: true, recommended: true,
      limits: { dealflow: -1 } },
    // Founder plans
    { name: "Founder Launchpad", role: "founder", amount: 699, duration: "monthly", popular: false, recommended: true,
      limits: { pitches: 10, investor_connects: 5 } },
  ];

  const plans: any[] = [];
  for (const p of planDefs) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { name: p.name } });
    if (existing) {
      plans.push(existing);
    } else {
      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: p.name, role: p.role, amount: p.amount, currency: "INR",
          duration: p.duration, popular: p.popular, recommended: p.recommended,
          limits: JSON.stringify(p.limits),
          features: JSON.stringify([`${p.name} access`, "24/7 Support", "Analytics Dashboard"]),
        },
      });
      plans.push(plan);
    }
  }
  console.log(`  ✓ ${plans.length} plans created`);

  // ─────────────────────────────────────────
  // 4. PLATFORM USERS (300 users)
  // ─────────────────────────────────────────
  console.log("Creating 300 platform users...");
  const roles = ["freelancer", "client", "investor", "founder"];
  const firstNames = ["Arjun", "Priya", "Rahul", "Ananya", "Vikram", "Sneha", "Karan", "Divya", "Rohit", "Meera",
    "Amit", "Pooja", "Suresh", "Deepa", "Raj", "Nisha", "Arun", "Kavya", "Sanjay", "Lakshmi",
    "James", "Sarah", "Michael", "Emma", "David", "Olivia", "Alex", "Sophie", "Chris", "Lisa"];
  const lastNames = ["Sharma", "Patel", "Singh", "Kumar", "Gupta", "Mehta", "Joshi", "Reddy", "Nair", "Iyer",
    "Smith", "Johnson", "Williams", "Brown", "Davis", "Wilson", "Taylor", "Anderson", "White", "Harris"];

  const users: any[] = [];
  for (let i = 0; i < 300; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const role = pick(roles);
    const referralCode = `GE${i.toString().padStart(5, "0")}`;
    let u = await prisma.user.findUnique({ where: { referralCode } });
    if (!u) {
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@goexperts.com`;
      u = await prisma.user.create({
        data: {
          fullName: `${fn} ${ln}`,
          email,
          password: hashedPw,
          role,
          country: pick(countryNames),
          phone: `+91${rnd(7000000000, 9999999999)}`,
          status: pick(["active", "active", "active", "suspended", "inactive"]),
          isVerified: Math.random() > 0.2,
          referralCode,
          bio: `Experienced ${role} with ${rnd(1, 15)} years in ${pick(industryNames)}`,
          city: pick(["Mumbai", "Bangalore", "Delhi", "Chennai", "Hyderabad", "Pune", "Kolkata"]),
        },
      });
    }
    users.push(u);
  }
  console.log(`  ✓ ${users.length} users created`);

  // ─────────────────────────────────────────
  // 5. WALLETS for all users
  // ─────────────────────────────────────────
  console.log("Creating wallets...");
  const wallets: any[] = [];
  for (const u of users) {
    const w = await prisma.wallet.create({
      data: { userId: u.id, balance: rndFloat(0, 5000), currency: "INR" },
    });
    wallets.push(w);
  }
  console.log(`  ✓ ${wallets.length} wallets created`);

  // ─────────────────────────────────────────
  // 6. ACTIVE SUBSCRIPTIONS (100)
  // ─────────────────────────────────────────
  console.log("Creating 100 active subscriptions...");
  const activeSubUsers = users.slice(0, 100);
  const activeSubs: any[] = [];
  for (const u of activeSubUsers) {
    const plan = pick(plans.filter((p) => p.role === u.role || true));
    const start = addDays(new Date(), -rnd(1, 25));
    const end = addMonths(start, plan.duration === "yearly" ? 12 : plan.duration === "quarterly" ? 3 : 1);
    const sub = await prisma.subscription.create({
      data: {
        userId: u.id, planId: plan.id,
        status: "active", autoRenew: Math.random() > 0.3,
        startDate: start, endDate: end,
      },
    });
    activeSubs.push(sub);
  }
  console.log(`  ✓ ${activeSubs.length} active subscriptions created`);

  // ─────────────────────────────────────────
  // 7. EXPIRED SUBSCRIPTIONS (50)
  // ─────────────────────────────────────────
  console.log("Creating 50 expired subscriptions...");
  const expiredSubUsers = users.slice(100, 150);
  const expiredSubs: any[] = [];
  for (const u of expiredSubUsers) {
    const plan = pick(plans);
    const start = addDays(new Date(), -rnd(60, 365));
    const end = addDays(new Date(), -rnd(1, 30));
    const sub = await prisma.subscription.create({
      data: {
        userId: u.id, planId: plan.id,
        status: "expired", autoRenew: false,
        startDate: start, endDate: end,
      },
    });
    expiredSubs.push(sub);
  }
  console.log(`  ✓ ${expiredSubs.length} expired subscriptions created`);

  // ─────────────────────────────────────────
  // 8. RENEWALS (50 subscriptions renewed)
  // ─────────────────────────────────────────
  console.log("Creating 50 renewed subscriptions...");
  const renewedSubUsers = users.slice(150, 200);
  const renewedSubs: any[] = [];
  for (const u of renewedSubUsers) {
    const plan = pick(plans);
    const start = addDays(new Date(), -rnd(1, 20));
    const end = addMonths(start, 1);
    const sub = await prisma.subscription.create({
      data: {
        userId: u.id, planId: plan.id,
        status: "active", autoRenew: true,
        startDate: start, endDate: end,
      },
    });
    renewedSubs.push(sub);

    // Create history for renewal
    await prisma.subscriptionHistory.create({
      data: { userId: u.id, planId: plan.id, action: "renewed" },
    });
  }
  console.log(`  ✓ ${renewedSubs.length} renewals recorded`);

  const allSubs = [...activeSubs, ...expiredSubs, ...renewedSubs];

  // ─────────────────────────────────────────
  // 9. PAYMENTS (100 payments)
  // ─────────────────────────────────────────
  console.log("Creating 100 payments...");
  const gateways = ["razorpay", "stripe", "payu", "cashfree"];
  const paymentStatuses = ["completed", "completed", "completed", "failed", "pending"];
  const payments: any[] = [];
  const subSample = allSubs.slice(0, 100);

  for (const sub of subSample) {
    const plan = plans.find((p) => p.id === sub.planId) || plans[0];
    const gst = parseFloat((plan.amount * 0.18).toFixed(2));
    const total = parseFloat((plan.amount + gst).toFixed(2));
    const gateway = pick(gateways);
    const status = pick(paymentStatuses);

    const pmt = await prisma.payment.create({
      data: {
        userId: sub.userId, subscriptionId: sub.id,
        amount: total, currency: "INR", gateway,
        transactionId: `TXN-${uuid().substring(0, 12).toUpperCase()}`,
        status,
        createdAt: addDays(new Date(), -rnd(1, 90)),
      },
    });
    payments.push(pmt);

    // Create corresponding invoice
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${Date.now().toString(36).toUpperCase()}-${rnd(1000, 9999)}`,
        userId: sub.userId, subscriptionId: sub.id,
        subtotal: plan.amount, gst, discount: 0, total,
        status: status === "completed" ? "paid" : "unpaid",
      },
    });

    await prisma.invoiceItem.create({
      data: {
        invoiceId: inv.id,
        description: `${plan.name} Subscription (${plan.duration || "monthly"})`,
        amount: plan.amount, tax: gst,
      },
    });
  }
  console.log(`  ✓ ${payments.length} payments created with invoices`);

  // ─────────────────────────────────────────
  // 10. REFUNDS (30 refunds)
  // ─────────────────────────────────────────
  console.log("Creating 30 refunds...");
  const completedPayments = payments.filter((p) => p.status === "completed");
  const refundSample = completedPayments.slice(0, 30);
  let refundCount = 0;

  for (const pmt of refundSample) {
    await prisma.paymentRefund.create({
      data: {
        paymentId: pmt.id,
        amount: rndFloat(pmt.amount * 0.3, pmt.amount),
        reason: pick(["User request", "Duplicate payment", "Service not availed", "Technical error", "Goodwill refund"]),
        status: "processed",
        processedAt: addDays(new Date(), -rnd(1, 20)),
      },
    });
    refundCount++;
  }
  console.log(`  ✓ ${refundCount} refunds created`);

  // ─────────────────────────────────────────
  // 11. WALLET TRANSACTIONS (200)
  // ─────────────────────────────────────────
  console.log("Creating 200 wallet transactions...");
  const txnTypes = ["refund", "bonus", "referral_credit", "promotional", "debit"];
  let txnCount = 0;

  for (let i = 0; i < 200; i++) {
    const wallet = pick(wallets);
    const type = pick(txnTypes);
    const direction = type === "debit" ? "debit" : "credit";
    const amount = rndFloat(50, 2000);

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id, type, amount, direction,
        description: `${type} transaction`,
        balanceAfter: rndFloat(0, 10000),
        createdAt: addDays(new Date(), -rnd(1, 180)),
      },
    });
    txnCount++;
  }
  console.log(`  ✓ ${txnCount} wallet transactions created`);

  // ─────────────────────────────────────────
  // 12. COUPONS (50)
  // ─────────────────────────────────────────
  console.log("Creating 50 coupons...");
  const couponCodes = [
    "LAUNCH50", "WELCOME20", "ELITE30", "ANNUAL25", "FREELANCE15",
    "CLIENT40", "INVEST20", "REFER10", "SPECIAL35", "DIWALI50",
  ];
  const coupons: any[] = [];
  
  for (let i = 0; i < 50; i++) {
    const code = i < couponCodes.length ? couponCodes[i] : `PROMO${rnd(100, 999)}`;
    const discountType = pick(["percentage", "flat"]);
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (!existing) {
      const c = await prisma.coupon.create({
        data: {
          code,
          discount: discountType === "percentage" ? `${rnd(10, 50)}` : `${rnd(100, 1000)}`,
          discountType,
          maxUses: rnd(50, 500),
          uses: rnd(0, 49),
          roleFilter: Math.random() > 0.6 ? pick(roles) : null,
          expires: addMonths(new Date(), rnd(1, 12)).toISOString().split("T")[0],
          status: pick(["active", "active", "active", "inactive"]),
        },
      });
      coupons.push(c);
    }
  }
  console.log(`  ✓ ${coupons.length} coupons created`);

  // ─────────────────────────────────────────
  // 13. ADVERTISEMENT PLANS + ADS (30 ad packages)
  // ─────────────────────────────────────────
  console.log("Creating 30 advertisement packages...");
  const placements = ["homepage_banner", "sidebar_banner", "category_banner", "search_results", "email_newsletter"];
  const adPlanDefs = [
    { name: "Starter Banner", duration: "weekly", price: 1999, clicksLimit: 500, viewsLimit: 5000, placement: "sidebar_banner" },
    { name: "Business Banner", duration: "monthly", price: 5999, clicksLimit: 2000, viewsLimit: 20000, placement: "homepage_banner" },
    { name: "Enterprise Spotlight", duration: "monthly", price: 14999, clicksLimit: 10000, viewsLimit: 100000, placement: "homepage_banner" },
    { name: "Category Leader", duration: "weekly", price: 3499, clicksLimit: 1500, viewsLimit: 15000, placement: "category_banner" },
    { name: "Email Blast", duration: "daily", price: 999, clicksLimit: 200, viewsLimit: 10000, placement: "email_newsletter" },
  ];

  const adPlans: any[] = [];
  for (const apd of adPlanDefs) {
    const ap = await prisma.advertisementPlan.create({ data: apd });
    adPlans.push(ap);
  }

  // Create 30 advertisements
  const adStatuses = ["pending", "active", "active", "completed", "rejected"];
  for (let i = 0; i < 30; i++) {
    const adUser = pick(users);
    const adPlan = pick(adPlans);
    const status = pick(adStatuses);
    const startDate = status !== "pending" ? addDays(new Date(), -rnd(1, 30)) : null;
    const endDate = startDate ? addDays(startDate, pick([7, 14, 30])) : null;

    await prisma.advertisement.create({
      data: {
        planId: adPlan.id, userId: adUser.id,
        title: `${adUser.fullName.split(" ")[0]}'s ${pick(["Professional", "Expert", "Premium", "Elite"])} Service`,
        bannerUrl: `https://picsum.photos/seed/${rnd(1, 999)}/800/200`,
        targetUrl: `https://goexperts.com/profile/${adUser.id}`,
        clicksCount: rnd(0, adPlan.clicksLimit),
        viewsCount: rnd(0, adPlan.viewsLimit),
        status,
        startDate,
        endDate,
        createdAt: addDays(new Date(), -rnd(1, 60)),
      },
    });
  }
  console.log(`  ✓ 5 ad plans + 30 advertisements created`);

  // ─────────────────────────────────────────
  // 14. FEATURED SERVICES (50)
  // ─────────────────────────────────────────
  console.log("Creating 50 featured listings...");
  const featuredPlanNames = ["Basic Spotlight", "Pro Spotlight", "Elite Spotlight"];
  const targetTypes = ["freelancer", "startup", "investor", "company"];

  for (let i = 0; i < 50; i++) {
    const u = pick(users);
    const durationDays = pick([7, 14, 30, 60, 90]);
    const startDate = addDays(new Date(), -rnd(0, 30));
    const endDate = addDays(startDate, durationDays);
    const isActive = endDate > new Date();

    await prisma.featuredService.create({
      data: {
        userId: u.id,
        targetType: pick(targetTypes),
        targetId: u.id,
        planName: pick(featuredPlanNames),
        price: pick([1999, 3999, 7999]),
        startDate, endDate,
        status: isActive ? "active" : "expired",
      },
    });
  }
  console.log(`  ✓ 50 featured listings created`);

  // ─────────────────────────────────────────
  // 15. REFERRALS (50 referral chains)
  // ─────────────────────────────────────────
  console.log("Creating 50 referrals...");
  const shuffled = [...users].sort(() => Math.random() - 0.5);
  let refCount = 0;
  const usedReferees = new Set<string>();

  for (let i = 0; i < 100 && refCount < 50; i++) {
    const referrer = shuffled[i];
    const referee = shuffled[i + 100];
    if (!referee || usedReferees.has(referee.id) || referrer.id === referee.id) continue;
    usedReferees.add(referee.id);

    const ref = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId: referee.id,
        link: `https://goexperts.com/ref/${referrer.id.substring(0, 8)}`,
        status: pick(["pending", "rewarded", "pending"]),
      },
    });

    if (ref.status === "rewarded") {
      await prisma.referralReward.create({
        data: { referralId: ref.id, points: rnd(50, 200), amount: rndFloat(100, 500) },
      });
    }
    refCount++;
  }
  console.log(`  ✓ ${refCount} referrals created`);

  // ─────────────────────────────────────────
  // 16. PROJECTS, PROPOSALS, CONTRACTS
  // ─────────────────────────────────────────
  console.log("Creating projects, proposals, contracts...");
  const clients = users.filter((u) => u.role === "client").slice(0, 20);
  const freelancers = users.filter((u) => u.role === "freelancer").slice(0, 40);

  const projectStatuses = ["published", "active", "completed", "closed"];
  const projects: any[] = [];

  for (const client of clients) {
    for (let j = 0; j < 2; j++) {
      const p = await prisma.project.create({
        data: {
          title: `${pick(["Build", "Design", "Develop", "Create"])} ${pick(["E-Commerce App", "SaaS Platform", "Mobile App", "API Service", "Dashboard"])}`,
          client: client.fullName,
          freelancer: null,
          category: pick(["Web Development", "Mobile App", "AI/ML", "DevOps", "UI/UX Design", "Data Science"]),
          technology: pick(["React", "Node.js", "Python", "Flutter", "TypeScript", "Django"]),
          status: pick(["open", "in_progress", "completed", "cancelled"]),
          budget: rnd(10000, 500000),
          timeline: `${rnd(1, 6)} months`,
        },
      });
      projects.push(p);
    }
  }

  // Proposals
  const proposals: any[] = [];
  for (const project of projects.slice(0, 20)) {
    for (let k = 0; k < rnd(2, 6); k++) {
      const freelancer = pick(freelancers.length > 0 ? freelancers : users);
      const propStatus = pick(["pending", "shortlisted", "interview", "offer", "accepted", "rejected"]);
      const prop = await prisma.proposal.create({
        data: {
          projectId: project.id,
          freelancerId: freelancer.id,
          coverLetter: `I am highly experienced in building solutions like what you need. ${rnd(5, 15)} years of experience.`,
          bidAmount: rnd(5000, 200000),
          status: propStatus,
        },
      });
      proposals.push(prop);

      // Create contract for accepted proposals
      if (propStatus === "accepted") {
        await prisma.contract.create({
          data: {
            contractNumber: `CTR-${Date.now().toString(36).toUpperCase()}-${rnd(100, 999)}`,
            projectId: project.id,
            clientId: pick(clients.length > 0 ? clients : users).id,
            freelancerId: freelancer.id,
            proposalId: prop.id,
            status: pick(["active", "completed"]),
          },
        });

        // Milestones (attached to project, not contract)
        const numMilestones = rnd(2, 4);
        for (let m = 0; m < numMilestones; m++) {
          await prisma.milestone.create({
            data: {
              projectId: project.id,
              title: `Milestone ${m + 1}: ${pick(["Design", "Development", "Testing", "Deployment", "Review"])}`,
              dueDate: addDays(new Date(), (m + 1) * rnd(7, 20)).toISOString().split("T")[0],
              status: m === 0 ? pick(["Completed", "In Progress"]) : "Pending",
            },
          });
        }
      }
    }
  }

  console.log(`  ✓ ${projects.length} projects, ${proposals.length} proposals, contracts + milestones created`);

  // ─────────────────────────────────────────
  // 17. REVIEWS
  // ─────────────────────────────────────────
  console.log("Creating reviews...");
  for (let i = 0; i < 30; i++) {
    const reviewer = pick(users);
    const reviewee = pick(users.filter((u) => u.id !== reviewer.id));
    const project = pick(projects);
    await prisma.review.create({
      data: {
        projectId: project.id,
        reviewerId: reviewer.id,
        revieweeId: reviewee.id,
        rating: rnd(3, 5),
        comment: pick([
          "Outstanding work! Highly professional.",
          "Great communication and delivered on time.",
          "Very knowledgeable and skilled professional.",
          "Would definitely recommend and work again.",
          "Exceeded all expectations. Top quality.",
        ]),
      },
    });
  }
  console.log(`  ✓ 30 reviews created`);

  // ─────────────────────────────────────────
  // 18. SUPPORT TICKETS
  // ─────────────────────────────────────────
  console.log("Creating support tickets...");
  const ticketStatuses = ["open", "in_progress", "resolved", "closed"];
  const categories = ["Billing", "Technical", "Account", "Subscription", "General"];
  for (let i = 0; i < 40; i++) {
    await prisma.supportTicket.create({
      data: {
        subject: pick(["Payment not processed", "Cannot login", "Subscription not activated", "Profile issue", "Feature request"]),
        user: pick(users).fullName,
        category: pick(categories),
        status: pick(["Open", "Resolved", "Closed"]),
        priority: pick(["Low", "Medium", "High", "Urgent"]),
      },
    });
  }
  console.log(`  ✓ 40 support tickets created`);

  // ─────────────────────────────────────────
  // 19. NOTIFICATION TEMPLATES
  // ─────────────────────────────────────────
  console.log("Creating notification templates...");
  const templateDefs = [
    // Subscription
    { code: "SUBSCRIPTION_ACTIVATED", category: "subscription", channel: "email", subject: "Your {{plan}} subscription is now active!", body: "Hi {{name}},\n\nYour subscription to **{{plan}}** has been activated successfully.\n\nStart date: {{startDate}}\nExpiry: {{endDate}}\n\nEnjoy your access!\n\nTeam Go Experts", variables: ["name","plan","startDate","endDate"] },
    { code: "SUBSCRIPTION_EXPIRY_WARNING", category: "subscription", channel: "email", subject: "Your subscription expires in {{days}} days", body: "Hi {{name}},\n\nThis is a reminder that your **{{plan}}** subscription will expire in {{days}} days on {{endDate}}.\n\nRenew now to avoid interruption.", variables: ["name","plan","days","endDate"] },
    { code: "SUBSCRIPTION_EXPIRED", category: "subscription", channel: "in_app", subject: "Subscription expired", body: "Your {{plan}} subscription has expired. Renew now to continue accessing premium features.", variables: ["plan"] },
    { code: "SUBSCRIPTION_RENEWAL_SUCCESS", category: "subscription", channel: "email", subject: "Subscription renewed successfully", body: "Hi {{name}},\n\nYour **{{plan}}** has been renewed. New expiry: {{endDate}}.", variables: ["name","plan","endDate"] },
    // Payments
    { code: "PAYMENT_SUCCESS", category: "payment", channel: "email", subject: "Payment of ₹{{amount}} received", body: "Hi {{name}},\n\nWe have received your payment of ₹{{amount}} for **{{plan}}**.\n\nTransaction ID: {{txnId}}\n\nThank you!", variables: ["name","amount","plan","txnId"] },
    { code: "PAYMENT_FAILED", category: "payment", channel: "email", subject: "Payment failed – Please retry", body: "Hi {{name}},\n\nYour payment of ₹{{amount}} failed. Please retry or use a different payment method.", variables: ["name","amount"] },
    { code: "PAYMENT_REFUND", category: "payment", channel: "email", subject: "Refund of ₹{{amount}} initiated", body: "Hi {{name}},\n\nA refund of ₹{{amount}} has been initiated and will reflect in 5–7 business days.", variables: ["name","amount"] },
    // Wallet
    { code: "WALLET_CREDIT", category: "wallet", channel: "in_app", subject: "Wallet credited ₹{{amount}}", body: "Your wallet has been credited with ₹{{amount}}. Your updated balance is available in the wallet section.", variables: ["amount"] },
    { code: "WALLET_DEBIT", category: "wallet", channel: "in_app", subject: "Wallet debited ₹{{amount}}", body: "₹{{amount}} has been debited from your wallet. If this was not you, please contact support.", variables: ["amount"] },
    { code: "WALLET_LOW_BALANCE", category: "wallet", channel: "in_app", subject: "Low wallet balance", body: "Your wallet balance is running low. Add funds to continue seamless transactions.", variables: [] },
    // Projects
    { code: "PROJECT_APPROVED", category: "project", channel: "in_app", subject: "Your project '{{projectTitle}}' is live!", body: "Your project **{{projectTitle}}** has been approved and is now visible to freelancers.", variables: ["projectTitle"] },
    { code: "PROJECT_PROPOSAL_RECEIVED", category: "project", channel: "in_app", subject: "New proposal on '{{projectTitle}}'", body: "You have received a new proposal from **{{freelancerName}}** on your project **{{projectTitle}}**.", variables: ["projectTitle","freelancerName"] },
    { code: "CONTRACT_SIGNED", category: "contract", channel: "email", subject: "Contract signed – {{contractNumber}}", body: "Hi {{name}},\n\nContract **{{contractNumber}}** has been signed. Work can now begin!\n\nProject: {{projectTitle}}", variables: ["name","contractNumber","projectTitle"] },
    // Security
    { code: "LOGIN_ALERT", category: "security", channel: "email", subject: "New login detected on your account", body: "Hi {{name}},\n\nA new login was detected from {{device}} at {{time}}.\n\nIf this was not you, please reset your password immediately.", variables: ["name","device","time"] },
    // Marketing
    { code: "WELCOME", category: "marketing", channel: "email", subject: "Welcome to Go Experts, {{name}}!", body: "Hi {{name}},\n\nWelcome aboard! You're now part of India's fastest-growing expert marketplace.\n\nExplore plans, find talent, or post your first project today.", variables: ["name"] },
    { code: "CAMPAIGN_GENERAL", category: "marketing", channel: "email", subject: "{{campaignTitle}}", body: "{{campaignBody}}", variables: ["campaignTitle","campaignBody"] },
    { code: "CAMPAIGN_SMS", category: "marketing", channel: "sms", subject: null, body: "{{smsBody}}", variables: ["smsBody"] },
  ];

  const templates: any[] = [];
  for (const t of templateDefs) {
    const tmpl = await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        category: t.category,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        variables: JSON.stringify(t.variables),
        status: "active",
      },
      create: {
        name: t.code.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        code: t.code,
        category: t.category,
        channel: t.channel,
        subject: t.subject,
        body: t.body,
        variables: JSON.stringify(t.variables),
        status: "active",
      },
    });
    templates.push(tmpl);
  }
  console.log(`  ✓ ${templates.length} notification templates created/updated`);

  // ─────────────────────────────────────────
  // 20. NOTIFICATION PREFERENCES (sample users)
  // ─────────────────────────────────────────
  console.log("Creating notification preferences for 50 users...");
  const prefSample = users.slice(0, 50);
  for (const u of prefSample) {
    await prisma.notificationPreference.upsert({
      where: { userId: u.id },
      update: {
        inAppEnabled: true,
        emailEnabled: Math.random() > 0.2,
        smsEnabled: Math.random() > 0.5,
        whatsappEnabled: Math.random() > 0.6,
        pushEnabled: false,
        preferences: JSON.stringify({
          categories: ["subscription","payment","wallet","project","security"],
          quietHoursStart: pick(["22:00","23:00","00:00"]),
          quietHoursEnd: pick(["07:00","08:00","06:00"]),
        }),
      },
      create: {
        userId: u.id,
        inAppEnabled: true,
        emailEnabled: Math.random() > 0.2,
        smsEnabled: Math.random() > 0.5,
        whatsappEnabled: Math.random() > 0.6,
        pushEnabled: false,
        preferences: JSON.stringify({
          categories: ["subscription","payment","wallet","project","security"],
          quietHoursStart: pick(["22:00","23:00","00:00"]),
          quietHoursEnd: pick(["07:00","08:00","06:00"]),
        }),
      },
    });
  }
  console.log(`  ✓ Notification preferences seeded for 50 users`);

  // ─────────────────────────────────────────
  // 21. SAMPLE IN-APP NOTIFICATIONS (100)
  // ─────────────────────────────────────────
  console.log("Creating 100 sample in-app notifications...");
  const notifCategories = ["subscription","payment","wallet","project","security","marketing"];
  const notifTitles = [
    "Subscription activated", "Payment received", "Wallet credited",
    "New proposal received", "Contract signed", "Login alert",
    "Subscription expiring soon", "Refund processed", "Project approved",
  ];
  let notifCount = 0;
  for (let i = 0; i < 100; i++) {
    const u = pick(users);
    const cat = pick(notifCategories);
    const createdAt = addDays(new Date(), -rnd(0, 30));
    const status = pick(["delivered","delivered","delivered","read","failed"]);
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: cat, channel: "in_app",
        title: pick(notifTitles),
        message: `This is a sample ${cat} notification for testing the notification system.`,
        status,
        readAt: status === "read" ? new Date() : null,
        createdAt,
      },
    });
    notifCount++;
  }
  console.log(`  ✓ ${notifCount} sample notifications created`);

  // ─────────────────────────────────────────
  // 22. NOTIFICATION CAMPAIGNS (5)
  // ─────────────────────────────────────────
  console.log("Creating 5 notification campaigns...");
  const campaignDefs = [
    {
      name: "Welcome New Users", templateCode: "WELCOME", channel: "email",
      targetAudience: JSON.stringify({ roles: ["freelancer","client"] }),
      status: "completed", scheduledAt: addDays(new Date(), -7),
      totalTargeted: 150, totalSent: 148, totalFailed: 2,
    },
    {
      name: "Subscription Renewal Reminder", templateCode: "SUBSCRIPTION_EXPIRY_WARNING", channel: "email",
      targetAudience: JSON.stringify({ roles: ["freelancer","client","investor","founder"], subscriptionStatus: "active" }),
      status: "completed", scheduledAt: addDays(new Date(), -3),
      totalTargeted: 100, totalSent: 99, totalFailed: 1,
    },
    {
      name: "Diwali Promo Push", templateCode: "CAMPAIGN_GENERAL", channel: "in_app",
      targetAudience: JSON.stringify({ roles: ["freelancer","client"] }),
      status: "draft", scheduledAt: addDays(new Date(), 5),
      totalTargeted: 0, totalSent: 0, totalFailed: 0,
    },
    {
      name: "SMS Blast – Platform Update", templateCode: "CAMPAIGN_SMS", channel: "sms",
      targetAudience: JSON.stringify({ roles: ["freelancer","client","investor","founder"] }),
      status: "scheduled", scheduledAt: addDays(new Date(), 2),
      totalTargeted: 300, totalSent: 0, totalFailed: 0,
    },
    {
      name: "Re-engagement Campaign", templateCode: "CAMPAIGN_GENERAL", channel: "email",
      targetAudience: JSON.stringify({ subscriptionStatus: "expired" }),
      status: "active",
      totalTargeted: 50, totalSent: 30, totalFailed: 5,
    },
  ];

  for (const cd of campaignDefs) {
    const tmpl = templates.find((t: any) => t.code === cd.templateCode);
    if (!tmpl) continue;
    
    const existingCampaign = await prisma.notificationCampaign.findFirst({
      where: { title: cd.name }
    });

    if (!existingCampaign) {
      await prisma.notificationCampaign.create({
        data: {
          title: cd.name,
          message: tmpl.body || "Default message template",
          targetFilter: cd.targetAudience,
          channels: JSON.stringify([cd.channel]),
          status: cd.status,
          scheduledAt: cd.scheduledAt,
        },
      });
    }
  }
  console.log(`  ✓ 5 notification campaigns seeded`);

  // ─────────────────────────────────────────
  // FINAL SUMMARY
  // ─────────────────────────────────────────
  console.log("\n✅ Go Experts Financial Seed Complete!\n");
  console.log("═══════════════════════════════════════════");
  console.log(`  📋 Subscription Plans:       ${plans.length}`);
  console.log(`  👥 Platform Users:           ${users.length}`);
  console.log(`  💳 Wallets:                  ${wallets.length}`);
  console.log(`  🟢 Active Subscriptions:     ${activeSubs.length}`);
  console.log(`  🔴 Expired Subscriptions:    ${expiredSubs.length}`);
  console.log(`  🔄 Renewals:                 ${renewedSubs.length}`);
  console.log(`  💰 Payments:                 ${payments.length}`);
  console.log(`  🔙 Refunds:                  ${refundCount}`);
  console.log(`  💸 Wallet Transactions:      ${txnCount}`);
  console.log(`  🎟  Coupons:                 ${coupons.length}`);
  console.log(`  📣 Ad Packages:              5 plans + 30 ads`);
  console.log(`  ⭐ Featured Listings:        50`);
  console.log(`  🤝 Referrals:               ${refCount}`);
  console.log(`  📁 Projects:                ${projects.length}`);
  console.log(`  📝 Proposals:               ${proposals.length}`);
  console.log(`  ⭐ Reviews:                 30`);
  console.log(`  🎫 Support Tickets:         40`);
  console.log(`  🔔 Notification Templates:  ${templates.length}`);
  console.log(`  🔕 Notification Prefs:      50 users`);
  console.log(`  📨 Sample Notifications:    ${notifCount}`);
  console.log(`  📣 Campaigns:               5`);

  // ─────────────────────────────────────────
  // PHASE 6: SYSTEM MONITORING SEED DATA
  // ─────────────────────────────────────────

  console.log("\n🔍 Seeding Phase 6: System Monitoring data...");

  // --- API Request Logs (1000 records) ---
  const apiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  const apiEndpoints = [
    "/api/admin/dashboard",
    "/api/admin/users",
    "/api/admin/projects",
    "/api/admin/subscriptions",
    "/api/admin/analytics/dashboard",
    "/api/admin/analytics/users",
    "/api/admin/financials/revenue",
    "/api/admin/notifications",
    "/api/admin/support_tickets",
    "/api/admin/investments",
    "/api/admin/startups",
    "/api/admin/payments",
    "/api/admin/jobs",
    "/api/admin/system/health",
    "/api/admin/system/operations-dashboard",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/admin/media",
    "/api/admin/reports/custom",
    "/api/admin/automation-rules",
  ];
  const statusCodes = [200, 200, 200, 200, 201, 204, 400, 401, 403, 404, 422, 500];
  const ipPool = [
    "192.168.1.10", "192.168.1.11", "10.0.0.5", "10.0.0.6",
    "172.16.0.2", "172.16.0.3", "203.0.113.5", "198.51.100.1",
  ];
  const agents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "PostmanRuntime/7.36.3",
    "axios/1.6.0",
    "node-fetch/3.3.2",
  ];

  console.log("  Creating 1000 API request logs...");
  const apiLogBatches: Promise<any>[] = [];
  for (let i = 0; i < 1000; i++) {
    const method = pick(apiMethods);
    const url = pick(apiEndpoints);
    const statusCode = pick(statusCodes);
    const responseTime = rnd(10, 800);
    const daysAgo = rnd(0, 30);
    const hoursAgo = rnd(0, 23);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(createdAt.getHours() - hoursAgo);

    apiLogBatches.push(
      prisma.apiRequestLog.create({
        data: {
          method,
          url,
          statusCode,
          responseTime,
          ipAddress: pick(ipPool),
          userAgent: pick(agents),
          error: statusCode >= 400 ? `HTTP ${statusCode} on ${method} ${url}` : null,
          createdAt,
        },
      })
    );
  }
  await Promise.all(apiLogBatches);
  console.log("  ✅ 1000 API request logs created.");

  // --- Login Attempts (100 records) ---
  const testEmails = [
    "admin@goexperts.com",
    "superadmin@goexperts.com",
    "unknown@hacker.com",
    "test@example.com",
    "manager@goexperts.com",
  ];
  const failReasons = ["Wrong password", "Email not found", "Account suspended"];

  console.log("  Creating 100 login attempts...");
  const loginBatches: Promise<any>[] = [];
  for (let i = 0; i < 100; i++) {
    const success = Math.random() > 0.35; // ~65% success rate
    const daysAgo = rnd(0, 30);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    loginBatches.push(
      prisma.loginAttempt.create({
        data: {
          email: pick(testEmails),
          ipAddress: pick(ipPool),
          userAgent: pick(agents),
          success,
          failReason: success ? null : pick(failReasons),
          createdAt,
        },
      })
    );
  }
  await Promise.all(loginBatches);
  console.log("  ✅ 100 login attempts created.");

  // --- System Alerts (20 records) ---
  const alertTypes = [
    "api_error_rate",
    "failed_jobs",
    "failed_notifications",
    "db_unavailable",
    "storage_full",
    "failed_logins",
    "backup_failed",
    "scheduler_stopped",
    "queue_overflow",
  ];
  const severities = ["info", "warning", "critical"];
  const alertStatuses = ["active", "active", "acknowledged", "resolved"];

  const alertTemplates = [
    { type: "api_error_rate", severity: "warning", title: "High API Error Rate Detected", message: "API error rate exceeded 5% in the last hour. 47 out of 820 requests returned 4xx/5xx status codes." },
    { type: "api_error_rate", severity: "critical", title: "Critical API Failure Spike", message: "API error rate exceeded 15% in the last 30 minutes. Immediate investigation required." },
    { type: "failed_jobs", severity: "warning", title: "Scheduled Jobs Failing", message: "3 scheduled jobs have failed in the last 24 hours. Check job history for details." },
    { type: "failed_jobs", severity: "critical", title: "Multiple Scheduler Failures", message: "8 jobs failed in the past hour. Scheduler may be experiencing critical issues." },
    { type: "failed_notifications", severity: "warning", title: "Notification Queue Backlog", message: "142 notifications are stuck in failed status. Retry mechanism activated." },
    { type: "failed_notifications", severity: "info", title: "Email Notification Delays", message: "SMTP service experiencing delays. Notifications queued for retry." },
    { type: "failed_logins", severity: "warning", title: "Suspicious Login Activity", message: "12 failed login attempts from IP 203.0.113.5 in the last 30 minutes." },
    { type: "failed_logins", severity: "critical", title: "Potential Brute Force Attack", message: "Over 50 failed login attempts detected from multiple IPs in the past hour." },
    { type: "backup_failed", severity: "critical", title: "Scheduled Backup Failed", message: "Nightly database backup did not complete successfully. Manual backup recommended." },
    { type: "backup_failed", severity: "warning", title: "Backup Size Anomaly", message: "Latest backup size (8.4 MB) is unusually large compared to average (2.1 MB)." },
    { type: "scheduler_stopped", severity: "critical", title: "Job Scheduler Not Responding", message: "Background job scheduler has not executed any jobs in the last 2 hours." },
    { type: "queue_overflow", severity: "warning", title: "Notification Queue Overflow", message: "Pending notification queue exceeded 500 items. Processing may be delayed." },
    { type: "storage_full", severity: "warning", title: "Storage Usage High", message: "Upload directory is using 85% of allocated storage. Consider cleanup or expansion." },
    { type: "storage_full", severity: "critical", title: "Storage Critically Full", message: "Upload directory is at 97% capacity. New file uploads may fail." },
    { type: "db_unavailable", severity: "info", title: "Database Slow Response", message: "Database query response time exceeded 500ms average in the last 15 minutes." },
    { type: "api_error_rate", severity: "info", title: "404 Errors Spike", message: "Increase in 404 Not Found errors detected. Frontend routing may have an issue." },
    { type: "failed_jobs", severity: "info", title: "Cron Job Skipped", message: "The 'Inactive Session Cleanup' job was skipped due to a locking conflict." },
    { type: "failed_notifications", severity: "warning", title: "WhatsApp Delivery Failures", message: "WhatsApp delivery rate dropped to 72% in the last hour (normal: >95%)." },
    { type: "failed_logins", severity: "info", title: "Unusual Login Location", message: "Admin login detected from an unusual IP geolocation (Country: Unknown)." },
    { type: "backup_failed", severity: "info", title: "Backup Schedule Changed", message: "Backup schedule was modified. Next backup is now scheduled for 02:00 UTC." },
  ];

  console.log("  Creating 20 system alerts...");
  const alertBatches: Promise<any>[] = [];
  for (let i = 0; i < alertTemplates.length; i++) {
    const tmpl = alertTemplates[i];
    const status = pick(alertStatuses);
    const daysAgo = rnd(0, 14);
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);

    alertBatches.push(
      prisma.systemAlert.create({
        data: {
          type: tmpl.type,
          severity: tmpl.severity,
          title: tmpl.title,
          message: tmpl.message,
          status,
          acknowledgedBy: status === "acknowledged" || status === "resolved" ? "system-admin" : null,
          acknowledgedAt: status === "acknowledged" || status === "resolved" ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
          resolvedBy: status === "resolved" ? "system-admin" : null,
          resolvedAt: status === "resolved" ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000) : null,
          createdAt,
        },
      })
    );
  }
  await Promise.all(alertBatches);
  console.log("  ✅ 20 system alerts created.");

  console.log("\n═══════════════════════════════════════════");
  console.log("✅ Phase 6 System Monitoring Seed Complete!");
  console.log("═══════════════════════════════════════════");
  console.log(`  📡 API Request Logs:         1000`);
  console.log(`  🔐 Login Attempts:           100`);
  console.log(`  🚨 System Alerts:            20`);
  console.log("═══════════════════════════════════════════\n");
}


main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
