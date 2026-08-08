export interface RawSkill {
  name: string;
  categorySlug: string;
  code: string;
  aliases?: string[];
  keywords?: string;
  isFeatured?: boolean;
  isTrending?: boolean;
}

export const RAW_SKILLS: RawSkill[] = [];

const TECH_SKILL_DOMAINS: { categorySlug: string; prefix: string; topics: string[] }[] = [
  {
    categorySlug: "software-development",
    prefix: "Software",
    topics: [
      "JavaScript Development", "TypeScript Architecture", "Python Development", "Java Enterprise Engineering", "C Programming",
      "C++ High Performance Development", "C# .NET Engineering", "Go Microservices Engineering", "Rust Systems Programming",
      "PHP Backend Development", "Ruby on Rails Development", "Kotlin Android Development", "Swift iOS Engineering",
      "Dart & Flutter Development", "Scala Functional Programming", "R Statistical Computing", "MATLAB Simulation",
      "SQL Database Querying", "Bash & Shell Automation", "PowerShell Scripting", "Solidity Smart Contracts", "Haskell Logic",
      "Elixir Distributed Systems", "Clojure Lisp Programming", "Erlang Telecom Systems", "Lua Scripting Engine", "Perl Automation"
    ]
  },
  {
    categorySlug: "frontend-development",
    prefix: "Frontend",
    topics: [
      "React.js Component Architecture", "Next.js App Router Optimization", "Vue.js 3 Composition API", "Nuxt.js SSR Setup",
      "Angular RxJS State Management", "SvelteKit Route Handlers", "Tailwind CSS Design Systems", "Sass/SCSS Modular Stylesheets",
      "Shadcn UI Customization", "Material UI (MUI) Theming", "Chakra UI Layouts", "Ant Design Enterprise Components",
      "Zustand State Stores", "Redux Toolkit Async Thunks", "TanStack Query Data Caching", "Three.js 3D Web Graphics",
      "WebAssembly (Wasm) Integration", "WebSockets Real-time UI", "Progressive Web Apps (PWA)", "Cross-Browser Compatibility",
      "Web Accessibility (WCAG 2.1)", "Single Page Application (SPA)", "Server-Side Rendering (SSR)", "Static Site Generation (SSG)"
    ]
  },
  {
    categorySlug: "backend-development",
    prefix: "Backend",
    topics: [
      "Node.js Microservices Architecture", "Express.js RESTful APIs", "NestJS Dependency Injection", "Django ORM Optimization",
      "FastAPI Asynchronous Endpoints", "Flask Lightweight Services", "Spring Boot Enterprise Services", "Laravel Eloquent ORM",
      "Ruby on Rails MVC", "ASP.NET Core Web API", "GraphQL Schema Design", "gRPC Protocol Buffers", "Prisma ORM Migrations",
      "TypeORM Entities", "Drizzle ORM Queries", "Hibernate Spatial Queries", "Celery Distributed Queue", "RabbitMQ Messaging",
      "Kafka Event Streams", "ZeroMQ Socket Protocol"
    ]
  },
  {
    categorySlug: "mobile-app-development",
    prefix: "Mobile",
    topics: [
      "Flutter Cross-Platform Apps", "React Native Native Modules", "iOS SwiftUI Reactive Layouts", "Android Jetpack Compose UI",
      "Expo Managed Workflows", "Mobile Push Notification Setup", "In-App Purchase Integration", "Mobile Offline Sync",
      "Biometric Authentication Setup", "App Store Optimization (ASO)", "Google Play Console Publishing", "TestFlight Beta Distribution",
      "CoreData iOS Storage", "Room Android Database", "Mobile Deep Linking"
    ]
  },
  {
    categorySlug: "ui-design",
    prefix: "UI Design",
    topics: [
      "Figma Design Systems", "Figma Auto Layout Components", "Figma Interactive Prototypes", "Design Tokens Management",
      "UI Component Libraries", "Mobile App UI Layouts", "Web Application UI Kits", "Dark Mode UI Design", "Micro-Interactions Design",
      "Design Handoff Preparation", "Iconography Design", "Typography Hierarchy", "Color Palette Definition", "Design System Audits"
    ]
  },
  {
    categorySlug: "ux-design",
    prefix: "UX Design",
    topics: [
      "User Experience Research", "User Journey Mapping", "Information Architecture", "Wireframing & Low-Fi Mocks",
      "Usability Testing & Interviews", "Persona Creation", "A/B Test Design Verification", "Card Sorting Studies",
      "Customer Empathy Mapping", "UX Heuristic Audit", "Accessibility UX Standards"
    ]
  },
  {
    categorySlug: "artificial-intelligence",
    prefix: "AI",
    topics: [
      "Deep Learning Neural Networks", "Artificial Intelligence Strategy", "AI Model Deployment", "Cognitive Computing Systems",
      "AI Ethics & Governance", "Generative AI Architectures", "Prompt Engineering Optimization", "Retrieval-Augmented Generation (RAG)",
      "OpenAI GPT-4 API Integration", "LangChain Agent Architecture", "LlamaIndex RAG Pipelines", "Vector Database Similarity Search",
      "Hugging Face Model Fine-Tuning", "LoRA / QLoRA Parameter Efficient Tuning", "Custom LLM Chatbot Development"
    ]
  },
  {
    categorySlug: "data-science",
    prefix: "Data Science",
    topics: [
      "Exploratory Data Analysis (EDA)", "Predictive Statistical Modeling", "Pandas Data Manipulation", "NumPy Scientific Computing",
      "Time Series Forecasting", "Statistical Hypothesis Testing", "PyTorch Neural Network Training", "TensorFlow Keras Models",
      "Scikit-Learn Classification", "XGBoost Gradient Boosting", "Feature Engineering Pipelines", "Model Hyperparameter Tuning"
    ]
  },
  {
    categorySlug: "cloud-computing",
    prefix: "Cloud",
    topics: [
      "AWS Cloud Infrastructure", "Microsoft Azure Cloud Services", "Google Cloud Platform (GCP)", "Serverless Lambda Functions",
      "Cloud Cost Optimization (FinOps)", "Multi-Cloud Strategy", "Docker Containerization", "Kubernetes Cluster Management",
      "Terraform Infrastructure as Code", "GitHub Actions CI/CD", "Jenkins Build Pipelines", "Ansible Configuration Playbooks"
    ]
  },
  {
    categorySlug: "cybersecurity",
    prefix: "Cybersecurity",
    topics: [
      "Penetration Testing & Ethical Hacking", "Vulnerability Assessment", "SOC 2 Type II Compliance", "ISO 27001 Security Audit",
      "Network Security & Firewalls", "Zero Trust Architecture", "Incident Response & Forensics", "Application Security (AppSec)"
    ]
  },
  {
    categorySlug: "digital-marketing",
    prefix: "Digital Marketing",
    topics: [
      "Digital Marketing Strategy", "Growth Hacking Funnels", "Multi-Channel Campaign Management", "Customer Lifecycle Marketing",
      "Technical SEO Audit", "Keyword Research & Strategy", "On-Page SEO Optimization", "Off-Page Backlink Building",
      "Google Search & Display Ads", "Meta Ads (Facebook & Instagram)", "LinkedIn B2B Advertising", "TikTok Video Ads"
    ]
  },
  {
    categorySlug: "finance-accounting",
    prefix: "Finance",
    topics: [
      "Financial Modeling & Forecasting", "DCF & LBO Valuation", "Bookkeeping in QuickBooks", "Tally ERP Prime Accounting",
      "Zoho Books Management", "Financial Statement Preparation", "GST Return Filing (India)", "Income Tax Return (ITR) Filing",
      "Corporate Tax Planning", "TDS / TCS Compliance", "Statutory Audit Preparation"
    ]
  }
];

let globalSkillCounter = 1;

// Seed base topics
for (const domain of TECH_SKILL_DOMAINS) {
  for (const topic of domain.topics) {
    RAW_SKILLS.push({
      name: topic,
      categorySlug: domain.categorySlug,
      code: `SKILL_CORE_${globalSkillCounter++}`,
      keywords: topic.toLowerCase(),
      isFeatured: globalSkillCounter % 4 === 0,
      isTrending: globalSkillCounter % 6 === 0
    });
  }
}

const SPECIALIZATIONS = [
  "Architecture", "Optimization", "Security Hardening", "Integration", "Migration", "Consulting",
  "Performance Tuning", "Audit & Compliance", "Automation", "Deployment", "Refactoring", "Troubleshooting",
  "Strategy", "Implementation", "Design", "Testing", "Analytics", "Administration", "Management", "Governance",
  "Monitoring", "Scaling", "Failover Setup", "Telemetry", "Benchmark Testing"
];

const FIELDS = [
  "Enterprise Software", "E-Commerce Systems", "FinTech Applications", "HealthTech Platforms", "EdTech Portals",
  "SaaS Infrastructure", "Mobile SDKs", "Cloud Native Services", "Data Pipelines", "AI Workflows",
  "Cyber Security Defenses", "B2B Marketplaces", "D2C Platforms", "Supply Chain Systems", "Real-Time Telemetry",
  "Robotics Automation", "IoT Networks", "DevOps Pipelines", "Micro-Frontend Systems", "High-Throughput APIS",
  "Web3 Protocols", "Payment Gateways", "CRM Systems", "ERP Solutions", "Digital Asset Management",
  "Customer Data Platforms", "BI Reporting Dashboards", "Vector Search Engines", "LLM Inference Workflows",
  "Multi-Tenant SaaS", "Serverless Workflows", "Edge Computing", "Quantum Computing Algorithms", "Spatial Computing Apps",
  "Distributed Caching", "Event-Driven Messaging", "Search Engine Indexing", "Graph Database Queries", "Time Series Analytics",
  "Zero-Trust Networks", "Container Mesh Routing", "API Gateway Routing", "Mobile Offline Caching", "Deep Learning Models",
  "Generative Image Diffusion", "Speech Recognition Models", "Natural Language Translation", "Computer Vision Tracking",
  "Automated Testing Suites", "CI/CD Pipeline Security", "Database Sharding", "ETL Stream Processing", "Log Aggregation"
];

for (const field of FIELDS) {
  for (const spec of SPECIALIZATIONS) {
    if (RAW_SKILLS.length >= 1250) break;
    const name = `${field} ${spec}`;
    const slug = field.toLowerCase().includes("ai") ? "artificial-intelligence" :
                 field.toLowerCase().includes("cloud") ? "cloud-computing" :
                 field.toLowerCase().includes("mobile") ? "mobile-app-development" :
                 field.toLowerCase().includes("security") ? "cybersecurity" : "software-development";
    RAW_SKILLS.push({
      name,
      categorySlug: slug,
      code: `SKILL_SPEC_${globalSkillCounter++}`,
      keywords: `${field} ${spec}`.toLowerCase(),
      isFeatured: globalSkillCounter % 5 === 0,
      isTrending: globalSkillCounter % 7 === 0
    });
  }
}
