const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SKILL_CATEGORIES = [
  { name: "Software Development", slug: "software-development", code: "CAT_SOFT_DEV", sortOrder: 1, keywords: "software, programming, engineering, code" },
  { name: "Web Development", slug: "web-development", code: "CAT_WEB_DEV", sortOrder: 2, keywords: "web, website, frontend, backend, fullstack" },
  { name: "Frontend Development", slug: "frontend-development", code: "CAT_FRONTEND", sortOrder: 3, keywords: "react, vue, angular, html, css, typescript" },
  { name: "Backend Development", slug: "backend-development", code: "CAT_BACKEND", sortOrder: 4, keywords: "node, python, java, express, nest, database" },
  { name: "Full Stack Development", slug: "full-stack-development", code: "CAT_FULLSTACK", sortOrder: 5, keywords: "mern, mean, fullstack, web, app" },
  { name: "Mobile App Development", slug: "mobile-app-development", code: "CAT_MOBILE", sortOrder: 6, keywords: "flutter, react native, ios, android, swift, kotlin" },
  { name: "Desktop Application Development", slug: "desktop-app-development", code: "CAT_DESKTOP", sortOrder: 7, keywords: "electron, c#, wpf, qt, java, desktop" },
  { name: "Game Development", slug: "game-development", code: "CAT_GAME_DEV", sortOrder: 8, keywords: "unity, unreal engine, c++, 3d, 2d, gaming" },
  { name: "Embedded Systems", slug: "embedded-systems", code: "CAT_EMBEDDED", sortOrder: 9, keywords: "c, microcontrollers, arduino, raspberry pi, iot" },
  { name: "API Development & Integration", slug: "api-development", code: "CAT_API_DEV", sortOrder: 10, keywords: "rest, graphql, gRPC, microservices, swagger" },
  { name: "Database Development & Admin", slug: "database-development", code: "CAT_DATABASE", sortOrder: 11, keywords: "postgresql, mysql, mongodb, redis, sql, dba" },
  { name: "Software Architecture", slug: "software-architecture", code: "CAT_ARCH", sortOrder: 12, keywords: "system design, microservices, cloud architecture" },

  // Design & Creative
  { name: "UI Design", slug: "ui-design", code: "CAT_UI_DESIGN", sortOrder: 13, keywords: "user interface, figma, sketch, design system, web design" },
  { name: "UX Design & Research", slug: "ux-design", code: "CAT_UX_DESIGN", sortOrder: 14, keywords: "user experience, wireframing, prototyping, user research" },
  { name: "Product Design", slug: "product-design", code: "CAT_PROD_DESIGN", sortOrder: 15, keywords: "product design, mobile design, web app design" },
  { name: "Graphic Design", slug: "graphic-design", code: "CAT_GRAPHIC", sortOrder: 16, keywords: "photoshop, illustrator, branding, posters, logo" },
  { name: "Branding & Identity", slug: "branding-identity", code: "CAT_BRANDING", sortOrder: 17, keywords: "brand strategy, logo design, visual identity, guidelines" },
  { name: "Illustration & Vector", slug: "illustration", code: "CAT_ILLUST", sortOrder: 18, keywords: "vector art, digital painting, character design" },
  { name: "Animation & Motion Graphics", slug: "animation-motion", code: "CAT_ANIMATION", sortOrder: 19, keywords: "after effects, 2d animation, 3d animation, lottie" },
  { name: "3D Design & Modeling", slug: "3d-design", code: "CAT_3D_DESIGN", sortOrder: 20, keywords: "blender, maya, 3ds max, rendering, cad" },
  { name: "Video Editing & Post Production", slug: "video-editing", code: "CAT_VIDEO_EDIT", sortOrder: 21, keywords: "premiere pro, final cut, color grading, reels" },
  { name: "Video Production", slug: "video-production", code: "CAT_VIDEO_PROD", sortOrder: 22, keywords: "videography, directing, scriptwriting, lighting" },
  { name: "Audio Production & Sound Design", slug: "audio-production", code: "CAT_AUDIO", sortOrder: 23, keywords: "podcasting, mixing, mastering, voiceover" },

  // AI & Data
  { name: "Artificial Intelligence", slug: "artificial-intelligence", code: "CAT_AI", sortOrder: 24, keywords: "ai, deep learning, neural networks, openai, llm" },
  { name: "Machine Learning", slug: "machine-learning", code: "CAT_ML", sortOrder: 25, keywords: "python, pytorch, tensorflow, scikit-learn, ml" },
  { name: "Generative AI & LLMs", slug: "generative-ai", code: "CAT_GEN_AI", sortOrder: 26, keywords: "chatgpt, langchain, prompt engineering, fine-tuning" },
  { name: "Data Science", slug: "data-science", code: "CAT_DATA_SCI", sortOrder: 27, keywords: "data analysis, predictive modeling, pandas, r" },
  { name: "Data Analytics & BI", slug: "data-analytics", code: "CAT_DATA_ANALYTICS", sortOrder: 28, keywords: "tableau, power bi, sql, google data studio, dashboards" },
  { name: "Data Engineering", slug: "data-engineering", code: "CAT_DATA_ENG", sortOrder: 29, keywords: "airflow, spark, kafka, snowflake, etl, data pipeline" },
  { name: "Computer Vision", slug: "computer-vision", code: "CAT_CV", sortOrder: 30, keywords: "opencv, yolo, image recognition, object detection" },
  { name: "Natural Language Processing", slug: "nlp", code: "CAT_NLP", sortOrder: 31, keywords: "spacy, nltk, sentiment analysis, text mining, bert" },

  // Infrastructure & Cyber
  { name: "Cloud Computing", slug: "cloud-computing", code: "CAT_CLOUD", sortOrder: 32, keywords: "aws, azure, gcp, serverless, cloud architecture" },
  { name: "DevOps", slug: "devops", code: "CAT_DEVOPS", sortOrder: 33, keywords: "docker, kubernetes, terraform, ci/cd, jenkins, github actions" },
  { name: "Site Reliability Engineering", slug: "sre", code: "CAT_SRE", sortOrder: 34, keywords: "monitoring, datadog, prometheus, grafana, incident response" },
  { name: "Cybersecurity", slug: "cybersecurity", code: "CAT_SECURITY", sortOrder: 35, keywords: "penetration testing, ethical hacking, soc, compliance, iso27001" },
  { name: "Network Engineering", slug: "network-engineering", code: "CAT_NETWORK", sortOrder: 36, keywords: "cisco, vpn, firewalls, routing, switching, dns" },
  { name: "System Administration", slug: "sysadmin", code: "CAT_SYSADMIN", sortOrder: 37, keywords: "linux, windows server, active directory, bash" },
  { name: "Quality Assurance & Testing", slug: "qa-testing", code: "CAT_QA", sortOrder: 38, keywords: "manual testing, selenium, cypress, playwriting, jest" },

  // Emerging Tech
  { name: "Blockchain & Web3", slug: "blockchain-web3", code: "CAT_BLOCKCHAIN", sortOrder: 39, keywords: "solidity, ethereum, smart contracts, dapps, bitcoin" },
  { name: "Internet of Things (IoT)", slug: "iot", code: "CAT_IOT", sortOrder: 40, keywords: "sensors, mqtt, embedded, smart devices" },
  { name: "Robotics & Automation", slug: "robotics", code: "CAT_ROBOTICS", sortOrder: 41, keywords: "ros, kinematics, automation, drones" },
  { name: "AR / VR & Metaverse", slug: "ar-vr", code: "CAT_AR_VR", sortOrder: 42, keywords: "augmented reality, virtual reality, openxr, unity" },

  // Business & Low Code
  { name: "CMS Development", slug: "cms-development", code: "CAT_CMS", sortOrder: 43, keywords: "wordpress, webflow, strapi, drupal, ghost" },
  { name: "E-Commerce Development", slug: "ecommerce-development", code: "CAT_ECOMMERCE", sortOrder: 44, keywords: "shopify, magento, woocommerce, medusa" },
  { name: "No-Code & Low-Code", slug: "nocode-lowcode", code: "CAT_NOCODE", sortOrder: 45, keywords: "bubble, make, n8n, zapier, retool, flutterflow" },
  { name: "ERP & CRM Solutions", slug: "erp-crm", code: "CAT_ERP_CRM", sortOrder: 46, keywords: "salesforce, sap, zoho, hubspot, odoo, oracle" },

  // Marketing & Sales
  { name: "Digital Marketing", slug: "digital-marketing", code: "CAT_DIGITAL_MKTG", sortOrder: 47, keywords: "online marketing, digital strategy, campaigns" },
  { name: "SEO (Search Engine Optimization)", slug: "seo", code: "CAT_SEO", sortOrder: 48, keywords: "technical seo, link building, keyword research, semrush" },
  { name: "SEM & PPC Advertising", slug: "sem-ppc", code: "CAT_PPC", sortOrder: 49, keywords: "google ads, meta ads, linkedin ads, conversion optimization" },
  { name: "Social Media Marketing", slug: "social-media-marketing", code: "CAT_SMM", sortOrder: 50, keywords: "instagram, linkedin, twitter, tiktok, content calendar" },
  { name: "Content Marketing & Strategy", slug: "content-marketing", code: "CAT_CONTENT_MKTG", sortOrder: 51, keywords: "blogging, ebooks, lead magnets, content funnel" },
  { name: "Email Marketing & Automation", slug: "email-marketing", code: "CAT_EMAIL_MKTG", sortOrder: 52, keywords: "klaviyo, mailchimp, activecampaign, drip campaigns" },
  { name: "Influencer & Affiliate Marketing", slug: "influencer-affiliate", code: "CAT_INFLUENCER", sortOrder: 53, keywords: "brand partnerships, affiliate networks, creator campaigns" },
  { name: "Growth Marketing & Hacking", slug: "growth-marketing", code: "CAT_GROWTH", sortOrder: 54, keywords: "funnel optimization, viral loops, retention, analytics" },
  { name: "Sales & Business Development", slug: "sales-bizdev", code: "CAT_SALES", sortOrder: 55, keywords: "b2b sales, cold outreach, closing, deal pipelines" },
  { name: "Lead Generation", slug: "lead-generation", code: "CAT_LEAD_GEN", sortOrder: 56, keywords: "prospecting, apollo, hunter, linkedin sales navigator" },
  { name: "Customer Success & Support", slug: "customer-success", code: "CAT_CS", sortOrder: 57, keywords: "zendesk, freshdesk, retention, onboarding, support tickets" },

  // Content & Writing
  { name: "Content Writing", slug: "content-writing", code: "CAT_CONTENT_WRITE", sortOrder: 58, keywords: "articles, blogs, creative writing, ghostwriting" },
  { name: "Copywriting", slug: "copywriting", code: "CAT_COPYWRITING", sortOrder: 59, keywords: "sales copy, landing page copy, ad copy, email copy" },
  { name: "Technical Writing", slug: "technical-writing", code: "CAT_TECH_WRITE", sortOrder: 60, keywords: "api docs, user manuals, whitepapers, developer docs" },
  { name: "Translation & Localization", slug: "translation", code: "CAT_TRANSLATION", sortOrder: 61, keywords: "languages, localization, proofreading, editing" },

  // Finance, Legal & HR
  { name: "Finance & Accounting", slug: "finance-accounting", code: "CAT_FINANCE", sortOrder: 62, keywords: "bookkeeping, quickbooks, tally, financial modeling" },
  { name: "Taxation & Compliance", slug: "taxation", code: "CAT_TAX", sortOrder: 63, keywords: "gst, income tax, corporate tax, audit, filing" },
  { name: "Investment Analysis & M&A", slug: "investment-analysis", code: "CAT_INVESTMENT", sortOrder: 64, keywords: "valuation, pitch deck, cap table, due diligence" },
  { name: "Legal Services", slug: "legal-services", code: "CAT_LEGAL", sortOrder: 65, keywords: "contracts, nda, ip law, trademark, corporate law" },
  { name: "Human Resources & Talent", slug: "hr-talent", code: "CAT_HR", sortOrder: 66, keywords: "recruitment, onboarding, payroll, HR policies" },

  // Management & Operations
  { name: "Project Management", slug: "project-management", code: "CAT_PROJ_MGMT", sortOrder: 67, keywords: "scrum, agile, jira, asana, pmp, kanban" },
  { name: "Product Management", slug: "product-management", code: "CAT_PROD_MGMT", sortOrder: 71, keywords: "roadmap, PRDs, user stories, product analytics" },
  { name: "Management & Strategy Consulting", slug: "management-consulting", code: "CAT_CONSULTING", sortOrder: 69, keywords: "business strategy, GTM, scaling, restructuring" },
  { name: "Operations & Supply Chain", slug: "operations-supply-chain", code: "CAT_OPERATIONS", sortOrder: 70, keywords: "logistics, procurement, inventory, process optimization" },
  { name: "Virtual Assistance & Admin", slug: "virtual-assistance", code: "CAT_VA", sortOrder: 71, keywords: "data entry, scheduling, email management, executive assistant" }
];

async function main() {
  const expCount = await prisma.experienceLevel.count();
  if (expCount === 0) {
    const items = [
      { name: 'Entry Level (0-2 Yrs)', status: 'active' },
      { name: 'Intermediate (2-5 Yrs)', status: 'active' },
      { name: 'Senior Level (5-8 Yrs)', status: 'active' },
      { name: 'Lead / Principal (8-12 Yrs)', status: 'active' },
      { name: 'Executive / Director (12+ Yrs)', status: 'active' }
    ];
    for (const it of items) {
      await prisma.experienceLevel.create({ data: it });
    }
    console.log('Seeded 5 ExperienceLevels');
  } else {
    console.log('ExperienceLevels already present:', expCount);
  }

  const engCount = await prisma.masterOption.count({ where: { type: 'engagement_type' } });
  if (engCount === 0) {
    const engs = ['Full-Time Contract', 'Part-Time Advisory', 'Project Milestone', 'Retainer Basis', 'Hourly Gig'];
    for (let i = 0; i < engs.length; i++) {
      await prisma.masterOption.create({
        data: { type: 'engagement_type', label: engs[i], value: engs[i], status: 'active', sortOrder: i + 1 }
      });
    }
    console.log('Seeded 5 EngagementTypes');
  } else {
    console.log('EngagementTypes already present:', engCount);
  }

  const catCount = await prisma.skillCategory.count();
  console.log(`Current SkillCategory count: ${catCount}`);
  if (catCount < SKILL_CATEGORIES.length) {
    for (const cat of SKILL_CATEGORIES) {
      await prisma.skillCategory.upsert({
        where: { slug: cat.slug },
        update: { name: cat.name, code: cat.code, sortOrder: cat.sortOrder, keywords: cat.keywords, status: 'active' },
        create: { name: cat.name, slug: cat.slug, code: cat.code, sortOrder: cat.sortOrder, keywords: cat.keywords, status: 'active' }
      }).catch(() => {});
    }
    const newCount = await prisma.skillCategory.count();
    console.log(`Seeded SkillCategories. New count: ${newCount}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
