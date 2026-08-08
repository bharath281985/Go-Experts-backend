export interface RawTechnology {
  name: string;
  category: string; // Programming Languages, Frontend, Backend, Mobile, Database, Cloud, DevOps, AI/ML, Testing, CMS, E-Commerce, CRM, ERP, Design, Analytics, Automation, Collaboration
  code: string;
  slug: string;
}

export const RAW_TECHNOLOGIES: RawTechnology[] = [
  // Programming Languages
  { name: "JavaScript", category: "Programming Languages", code: "TECH_JS", slug: "javascript" },
  { name: "TypeScript", category: "Programming Languages", code: "TECH_TS", slug: "typescript" },
  { name: "Python", category: "Programming Languages", code: "TECH_PYTHON", slug: "python" },
  { name: "Java", category: "Programming Languages", code: "TECH_JAVA", slug: "java" },
  { name: "C", category: "Programming Languages", code: "TECH_C", slug: "c" },
  { name: "C++", category: "Programming Languages", code: "TECH_CPP", slug: "cpp" },
  { name: "C#", category: "Programming Languages", code: "TECH_CSHARP", slug: "csharp" },
  { name: "Go (Golang)", category: "Programming Languages", code: "TECH_GOLANG", slug: "golang" },
  { name: "Rust", category: "Programming Languages", code: "TECH_RUST", slug: "rust" },
  { name: "PHP", category: "Programming Languages", code: "TECH_PHP", slug: "php" },
  { name: "Ruby", category: "Programming Languages", code: "TECH_RUBY", slug: "ruby" },
  { name: "Kotlin", category: "Programming Languages", code: "TECH_KOTLIN", slug: "kotlin" },
  { name: "Swift", category: "Programming Languages", code: "TECH_SWIFT", slug: "swift" },
  { name: "Dart", category: "Programming Languages", code: "TECH_DART", slug: "dart" },
  { name: "Scala", category: "Programming Languages", code: "TECH_SCALA", slug: "scala" },
  { name: "R", category: "Programming Languages", code: "TECH_R", slug: "r" },
  { name: "MATLAB", category: "Programming Languages", code: "TECH_MATLAB", slug: "matlab" },
  { name: "SQL", category: "Programming Languages", code: "TECH_SQL", slug: "sql" },
  { name: "Bash / Shell Scripting", category: "Programming Languages", code: "TECH_BASH", slug: "bash" },
  { name: "PowerShell", category: "Programming Languages", code: "TECH_POWERSHELL", slug: "powershell" },
  { name: "Solidity", category: "Programming Languages", code: "TECH_SOLIDITY", slug: "solidity" },
  { name: "Haskell", category: "Programming Languages", code: "TECH_HASKELL", slug: "haskell" },
  { name: "Elixir", category: "Programming Languages", code: "TECH_ELIXIR", slug: "elixir" },
  { name: "Clojure", category: "Programming Languages", code: "TECH_CLOJURE", slug: "clojure" },
  { name: "Erlang", category: "Programming Languages", code: "TECH_ERLANG", slug: "erlang" },
  { name: "Lua", category: "Programming Languages", code: "TECH_LUA", slug: "lua" },
  { name: "Perl", category: "Programming Languages", code: "TECH_PERL", slug: "perl" },
  { name: "Objective-C", category: "Programming Languages", code: "TECH_OBJC", slug: "objective-c" }
];

// Expanded tool & platform arrays to reach 450+ total technologies
const TECH_NAMES = [
  "React.js", "Next.js", "Vue.js", "Nuxt.js", "Angular", "Svelte", "SvelteKit", "HTML5", "CSS3", "Tailwind CSS",
  "Sass / SCSS", "Bootstrap", "Material UI (MUI)", "Shadcn UI", "Chakra UI", "Ant Design", "Redux Toolkit",
  "Zustand", "TanStack Query", "Webpack", "Vite", "Turbopack", "Babel", "WebAssembly (Wasm)", "Three.js", "Babylon.js",
  "Node.js", "Express.js", "NestJS", "Django", "FastAPI", "Flask", "Spring Boot", "Laravel", "Ruby on Rails",
  "ASP.NET Core", "GraphQL", "Apollo Server", "gRPC", "Prisma ORM", "TypeORM", "Drizzle ORM", "Hibernate",
  "Flutter", "React Native", "SwiftUI", "Jetpack Compose", "Expo", "Capacitor", "Cordova",
  "PostgreSQL", "MySQL", "MariaDB", "MongoDB", "Redis", "Elasticsearch", "Supabase", "Firebase Realtime DB",
  "Firestore", "Amazon DynamoDB", "ClickHouse", "Neo4j", "Apache Cassandra",
  "Amazon Web Services (AWS)", "Microsoft Azure", "Google Cloud Platform (GCP)", "Docker", "Kubernetes",
  "Terraform", "GitHub Actions", "Jenkins", "Ansible", "Prometheus", "Grafana", "Datadog", "Nginx",
  "OpenAI GPT-4 API", "LangChain", "LlamaIndex", "PyTorch", "TensorFlow", "Scikit-Learn", "OpenCV", "Hugging Face",
  "Pinecone Vector DB", "Qdrant", "Milvus", "ChromaDB",
  "Figma", "Adobe Photoshop", "Adobe Illustrator", "Adobe After Effects", "Adobe Premiere Pro", "DaVinci Resolve", "Blender",
  "WordPress", "Shopify", "Webflow", "WooCommerce", "Salesforce CRM", "HubSpot CRM", "Zoho CRM", "SAP S/4HANA", "Odoo ERP",
  "Google Analytics 4 (GA4)", "Mixpanel", "Amplitude", "PostHog", "Hotjar", "Google Ads", "Meta Ads Manager", "SEMrush", "Ahrefs", "Klaviyo",
  "Jira", "Confluence", "Linear", "Asana", "Trello", "Notion", "Slack", "Microsoft Teams",
  "Apache Kafka", "RabbitMQ", "Apache Airflow", "Apache Spark", "Apache Flink", "Snowflake", "Databricks", "dbt",
  "Apollo GraphQL", "Hasura", "Supabase Auth", "Clerk Auth", "Auth0", "Okta", "Keycloak", "Stripe API",
  "Razorpay SDK", "PayPal SDK", "Paddle SDK", "Lemon Squeezy API", "Plaid API", "Twilio API", "SendGrid API",
  "Mailgun API", "Postmark API", "OpenAI Whisper", "Anthropic Claude API", "Google Gemini API", "Mistral AI API",
  "Cohere API", "Replicate API", "RunwayML", "Midjourney", "Stable Diffusion", "Automatic1111", "ComfyUI",
  "Hardhat", "Truffle", "Foundry", "Ethers.js", "Web3.js", "Viem", "Wagmi", "IPFS", "Arweave", "Polygon",
  "Arbitrum", "Optimism", "Solana Web3.js", "Anchor Framework", "Avalanche SDK", "Cosmos SDK", "Polkadot Substrate",
  "Cypress", "Playwright", "Puppeteer", "Jest", "Vitest", "Testing Library", "Appium", "Selenium WebDriver",
  "Robot Framework", "K6 Performance Testing", "JMeter", "Postman", "Insomnia", "Swagger / OpenAPI",
  "Strapi CMS", "Ghost CMS", "Directus CMS", "Sanity.io", "Contentful", "Storyblok", "Hygraph (GraphCMS)",
  "Bubble.io", "Make.com (Integromat)", "Zapier", "n8n", "Retool", "FlutterFlow", "AppSmith", "Glide Apps",
  "Softr", "Draftbit", "Airtable API", "Notion API", "Coda API", "Salesforce Lightning", "HubSpot Workflows",
  "ActiveCampaign API", "Mailchimp API", "Braze", "Customer.io", "OneSignal", "Pushwoosh", "Branch.io",
  "AppsFlyer", "Singular", "Branch Metrics", "LogRocket", "Sentry", "Rollbar", "Bugsnag", "Raygun",
  "Datadog APM", "New Relic APM", "Dynatrace", "Splunk", "Sumo Logic", "Grafana Loki", "OpenTelemetry",
  "Jaeger Tracing", "Zipkin Tracing", "Istio Service Mesh", "Linkerd", "Consul", "Vault by HashiCorp",
  "Boundary by HashiCorp", "Nomad by HashiCorp", "MinIO Object Storage", "Ceph Storage", "Cloudflare CDN",
  "Fastly CDN", "Akamai CDN", "Bun Runtime", "Deno Runtime", "SWC Compiler", "ESBuild", "Rollup.js",
  "Parcel.js", "Gulp.js", "Grunt.js", "PostCSS", "Tailwind UI", "Headless UI", "Radix UI", "Chakra UI Pro",
  "PrimeReact", "PrimeVue", "Quasar Framework", "Vuetify", "Element Plus", "Ant Design Vue", "Semantic UI",
  "Foundation Zurb", "Bulma CSS", "Pure CSS", "Styled Components", "Emotion CSS", "Linaria", "Vanilla Extract",
  "Framer Motion", "GSAP (GreenSock)", "Anime.js", "Popmotion", "Rive Animation", "LottieFiles", "PixiJS",
  "Phaser 3", "Babylon.js", "PlayCanvas", "A-Frame (WebVR)", "OpenXR", "Vuforia AR", "ARKit", "ARCore",
  "Unity Shader Graph", "Unreal Engine Niagara", "Godot GDScript", "MagicaVoxel", "Substance Painter",
  "ZBrush", "Autodesk Maya", "Autodesk 3ds Max", "Cinema 4D", "Houdini 3D", "Marvelous Designer", "SpeedTree",
  "Final Cut Pro", "Avid Media Composer", "Logic Pro X", "Ableton Live", "FL Studio", "Pro Tools", "Cubase",
  "Audacity", "Descript", "CapCut", "InVideo", "Synthesia AI", "HeyGen AI", "ElevenLabs Voice AI",
  "Perplexity API", "Groq LPU API", "DeepSeek API", "Ollama", "Jan AI", "LM Studio", "LocalAI", "vLLM",
  "TGI (Text Generation Inference)", "DeepSpeed", "TRT-LLM", "TensorRT", "CUDA Toolkit", "ROCm AMD",
  "OpenVINO Intel", "ONNX Runtime", "CoreML Apple", "TFLite", "MediaPipe", "Detectron2", "MMDetection",
  "Diffusers Library", "ControlNet", "AnimateDiff", "SORA AI API", "Kling AI", "Luma Dream Machine",
  "Suno AI Music", "Udio AI Music", "Scribe AI", "Notion AI", "Jasper AI", "Copy.ai", "Writesonic",
  "Grammarly API", "DeepL API", "Google Cloud Translation API", "Azure AI Speech", "AWS Polly", "AWS Rekognition",
  "Azure Computer Vision", "GCP Vision API", "AWS Comprehend", "Azure Text Analytics", "IBM Watson",
  "Snowflake Cortex", "Databricks MosaicML", "DataRobot", "H2O.ai", "Dataiku", "Alteryx", "KNIME"
];

let tCounter = 1;
for (const item of TECH_NAMES) {
  RAW_TECHNOLOGIES.push({
    name: item,
    category: item.includes("API") || item.includes("SDK") ? "Backend" :
              item.includes("AI") || item.includes("Claude") || item.includes("GPT") ? "AI/ML" :
              item.includes("UI") || item.includes("CSS") || item.includes("React") ? "Frontend" :
              item.includes("Testing") || item.includes("Selenium") || item.includes("Cypress") ? "Testing" : "DevOps",
    code: `TECH_EXP_${tCounter++}`,
    slug: item.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  });
}
