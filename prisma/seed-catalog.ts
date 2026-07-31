import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATALOG_STRUCTURE = [
  {
    industry: "Technology",
    categories: [
      {
        name: "Website Development",
        sortOrder: 1,
        skills: ["React", "Node.js", "TypeScript", "Next.js", "Express", "GraphQL", "HTML/CSS", "Vue.js", "Angular"],
      },
      {
        name: "Mobile Apps",
        sortOrder: 2,
        skills: ["React Native", "Flutter", "Swift", "Kotlin", "iOS Development", "Android Development"],
      },
      {
        name: "Cloud & DevOps",
        sortOrder: 3,
        skills: ["AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Google Cloud", "Azure"],
      },
      {
        name: "AI Services & ML",
        sortOrder: 4,
        skills: ["Python", "PyTorch", "OpenAI API", "LangChain", "RAG", "TensorFlow", "Computer Vision"],
      },
      {
        name: "Cyber Security",
        sortOrder: 5,
        skills: ["Ethical Hacking", "Penetration Testing", "SOC Analysis", "ISO 27001", "Network Security"],
      },
    ],
  },
  {
    industry: "Marketing",
    categories: [
      {
        name: "Digital Marketing",
        sortOrder: 1,
        skills: ["Google Ads", "Meta Ads", "Performance Marketing", "Google Analytics", "PPC"],
      },
      {
        name: "SEO & Search Engine Marketing",
        sortOrder: 2,
        skills: ["Technical SEO", "On-Page SEO", "Link Building", "Keyword Research", "SEMrush"],
      },
      {
        name: "Content Writing",
        sortOrder: 3,
        skills: ["Copywriting", "Technical Writing", "SEO Content", "Blog Writing", "Brand Storytelling"],
      },
      {
        name: "Social Media Strategy",
        sortOrder: 4,
        skills: ["Instagram Growth", "LinkedIn Strategy", "TikTok Ads", "Community Management"],
      },
    ],
  },
  {
    industry: "Finance",
    categories: [
      {
        name: "Financial Advisory",
        sortOrder: 1,
        skills: ["Financial Modeling", "Valuation", "Corporate Finance", "Investment Strategy"],
      },
      {
        name: "Accounting & Tax",
        sortOrder: 2,
        skills: ["Bookkeeping", "GST / VAT Compliance", "QuickBooks", "Tax Filing", "Auditing"],
      },
      {
        name: "Investment Banking",
        sortOrder: 3,
        skills: ["M&A Consulting", "Due Diligence", "Pitch Decks", "Fundraising Advisory"],
      },
    ],
  },
  {
    industry: "Design & Creative",
    categories: [
      {
        name: "UI/UX Design",
        sortOrder: 1,
        skills: ["Figma", "Wireframing", "Prototyping", "Design Systems", "User Research", "Adobe XD"],
      },
      {
        name: "Graphic Design & Branding",
        sortOrder: 2,
        skills: ["Illustrator", "Photoshop", "Brand Identity", "Logo Design", "Packaging"],
      },
      {
        name: "Video & Animation",
        sortOrder: 3,
        skills: ["Premiere Pro", "After Effects", "Motion Graphics", "3D Animation", "Video Editing"],
      },
    ],
  },
  {
    industry: "Healthcare",
    categories: [
      {
        name: "Healthcare Software & EHR",
        sortOrder: 1,
        skills: ["HIPAA Compliance", "EHR Systems", "HL7 / FHIR Integration", "Medical Imaging"],
      },
      {
        name: "Telemedicine Platforms",
        sortOrder: 2,
        skills: ["WebRTC Video Calls", "Patient Portal", "E-Prescription Integration"],
      },
    ],
  },
  {
    industry: "E-Commerce",
    categories: [
      {
        name: "E-Commerce Store Development",
        sortOrder: 1,
        skills: ["Shopify", "WooCommerce", "Magento", "Payment Gateway Integration", "CRO"],
      },
    ],
  },
  {
    industry: "Education",
    categories: [
      {
        name: "LMS Platform Development",
        sortOrder: 1,
        skills: ["Moodle", "Canvas Integration", "SCORM", "LTI Standards", "Video Streaming"],
      },
      {
        name: "Instructional Design",
        sortOrder: 2,
        skills: ["Curriculum Development", "E-Learning Authoring", "Articulate Storyline", "Assessment Design"],
      },
    ],
  },
  {
    industry: "Real Estate",
    categories: [
      {
        name: "Property Listing & MLS",
        sortOrder: 1,
        skills: ["RETS/IDX Integration", "MLS Software", "Property Search", "Interactive Maps"],
      },
      {
        name: "Virtual Tours & 3D",
        sortOrder: 2,
        skills: ["Matterport", "3D Staging", "Virtual Reality Tours", "Architectural Rendering"],
      },
    ],
  },
  {
    industry: "Manufacturing",
    categories: [
      {
        name: "Industrial IoT & Automation",
        sortOrder: 1,
        skills: ["PLC Programming", "SCADA", "MQTT", "Predictive Maintenance", "Industry 4.0"],
      },
    ],
  },
  {
    industry: "Legal",
    categories: [
      {
        name: "Legal Tech & Contracts",
        sortOrder: 1,
        skills: ["Contract Automation", "Legal Document Drafting", "Compliance Audit", "IP Filing"],
      },
    ],
  },
  {
    industry: "Consulting",
    categories: [
      {
        name: "Business & IT Consulting",
        sortOrder: 1,
        skills: ["Business Strategy", "IT Consulting", "Process Optimization", "Change Management"],
      },
    ],
  },
];

async function seedCatalog() {
  console.log("🌱 Starting Full Catalog Seed for All 11 Industries (Industry -> Category -> Skill)...\n");

  let totalIndustries = 0;
  let totalCategories = 0;
  let totalSkills = 0;

  for (const block of CATALOG_STRUCTURE) {
    // 1. Upsert Industry
    const industryRow = await prisma.industry.upsert({
      where: { name: block.industry },
      update: { status: "active" },
      create: { name: block.industry, status: "active" },
    });
    totalIndustries++;
    console.log(`📁 Industry: ${industryRow.name} (${industryRow.id})`);

    for (const catDef of block.categories) {
      // 2. Upsert Category linked to Industry ID
      let categoryRow;
      try {
        categoryRow = await prisma.skillCategory.upsert({
          where: { name: catDef.name },
          update: {
            sortOrder: catDef.sortOrder,
            status: "active",
            industryId: industryRow.id,
          },
          create: {
            name: catDef.name,
            sortOrder: catDef.sortOrder,
            status: "active",
            industryId: industryRow.id,
          },
        });
      } catch {
        categoryRow = await prisma.skillCategory.upsert({
          where: { name: catDef.name },
          update: { sortOrder: catDef.sortOrder, status: "active" },
          create: { name: catDef.name, sortOrder: catDef.sortOrder, status: "active" },
        });
      }
      totalCategories++;
      console.log(`  └── 📁 Category: ${categoryRow.name} (${categoryRow.id})`);

      for (const skillName of catDef.skills) {
        // 3. Upsert Skill linked to Category ID and Industry Name
        try {
          await prisma.skill.upsert({
            where: { name: skillName },
            update: {
              categoryId: categoryRow.id,
              industry: industryRow.name,
              status: "active",
            },
            create: {
              name: skillName,
              categoryId: categoryRow.id,
              industry: industryRow.name,
              status: "active",
            },
          });
        } catch {
          await prisma.skill.upsert({
            where: { name: skillName },
            update: { industry: industryRow.name, status: "active" },
            create: { name: skillName, industry: industryRow.name, status: "active" },
          });
        }
        totalSkills++;
      }
    }
  }

  console.log(`\n✅ Full Catalog Seeding Completed Successfully!`);
  console.log(`📊 Summary: ${totalIndustries} Industries | ${totalCategories} Categories | ${totalSkills} Skills Created/Linked.`);
}

seedCatalog()
  .catch((e) => {
    console.error("❌ Catalog Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
