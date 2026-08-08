export interface RawIndustry {
  name: string;
  slug: string;
  code: string;
  description?: string;
  keywords?: string;
  isPopular?: boolean;
}

export const RAW_INDUSTRIES: RawIndustry[] = [
  // IT & Tech
  { name: "Information Technology", slug: "information-technology", code: "IND_IT", isPopular: true, keywords: "it, software, hardware, tech" },
  { name: "Software Development & SaaS", slug: "software-saas", code: "IND_SAAS", isPopular: true, keywords: "saas, cloud, web apps, enterprise software" },
  { name: "Artificial Intelligence & ML", slug: "ai-ml", code: "IND_AI", isPopular: true, keywords: "ai, machine learning, llm, deeptech" },
  { name: "Data Science & Big Data", slug: "data-science", code: "IND_DATA", isPopular: true, keywords: "analytics, data warehousing, BI" },
  { name: "Cybersecurity & InfoSec", slug: "cybersecurity", code: "IND_CYBER", isPopular: true, keywords: "security, firewalls, threat intelligence" },
  { name: "Cloud Computing & Infrastructure", slug: "cloud-computing", code: "IND_CLOUD", keywords: "aws, azure, gcp, hosting" },
  { name: "Telecommunications & 5G", slug: "telecom", code: "IND_TELECOM", keywords: "mobile networks, broadband, 5g" },
  { name: "Electronics & Hardware", slug: "electronics", code: "IND_ELECTRONICS", keywords: "circuitry, chips, hardware" },
  { name: "Semiconductors & Nanotech", slug: "semiconductors", code: "IND_SEMICON", keywords: "silicon, chips, fabrication" },
  { name: "Blockchain & Web3", slug: "blockchain-web3", code: "IND_WEB3", keywords: "crypto, defi, smart contracts" },
  { name: "Internet of Things (IoT)", slug: "iot-tech", code: "IND_IOT", keywords: "smart devices, sensors, connected tech" },
  { name: "Robotics & Industrial Automation", slug: "robotics-tech", code: "IND_ROBOTICS", keywords: "industrial robots, automation" },
  { name: "AR / VR & Spatial Computing", slug: "ar-vr-metaverse", code: "IND_ARVR", keywords: "spatial computing, virtual reality" },
  { name: "DevOps & Developer Tools", slug: "devops-devtools", code: "IND_DEVTOOLS", keywords: "ci/cd, testing, compilers" },
  { name: "No-Code & Low-Code Platforms", slug: "nocode-platforms", code: "IND_NOCODE_PLAT", keywords: "automation, visual builders" },
  { name: "Quantum Computing & Photonics", slug: "quantum-computing", code: "IND_QUANTUM", keywords: "qubits, photonics, quantum algorithms" },
  { name: "Autonomous Systems & Drones", slug: "drones-autonomous", code: "IND_DRONES", keywords: "uav, self driving, drones" },

  // Financial Services
  { name: "Financial Technology (FinTech)", slug: "fintech", code: "IND_FINTECH", isPopular: true, keywords: "payments, neobanks, lending, neo banking" },
  { name: "Banking & Financial Services", slug: "banking-finance", code: "IND_BANKING", isPopular: true, keywords: "banks, credit, loans, wealth management" },
  { name: "Insurance & InsurTech", slug: "insurance-insurtech", code: "IND_INSURANCE", keywords: "underwriting, claims, insurtech" },
  { name: "Investment Management & Wealth", slug: "investment-wealth", code: "IND_INVESTMENT", keywords: "asset management, mutual funds, portfolio" },
  { name: "Venture Capital & Private Equity", slug: "vc-pe", code: "IND_VC_PE", isPopular: true, keywords: "funding, investors, equity, venture" },
  { name: "Accounting, Audit & Tax", slug: "accounting-tax", code: "IND_ACCOUNTING", keywords: "audit, tax, bookkeeping, chartered accountants" },
  { name: "Microfinance & Inclusion", slug: "microfinance", code: "IND_MICROFIN", keywords: "small loans, rural banking" },
  { name: "Capital Markets & Stock Exchanges", slug: "capital-markets", code: "IND_CAPITAL_MKTS", keywords: "trading, equity markets, stock broker" },

  // Real Estate & Construction
  { name: "Real Estate & PropTech", slug: "real-estate-proptech", code: "IND_PROPTECH", isPopular: true, keywords: "property, residential, commercial, proptech" },
  { name: "Construction & Civil Infrastructure", slug: "construction", code: "IND_CONSTRUCTION", keywords: "building, civil engineering, contracting" },
  { name: "Architecture & Interior Design", slug: "architecture-interior", code: "IND_ARCH", keywords: "spatial design, blueprints, interiors" },
  { name: "Facility Management & Smart Buildings", slug: "facility-mgmt", code: "IND_FACILITY", keywords: "maintenance, HVAC, building ops" },
  { name: "Coworking & Shared Workspaces", slug: "coworking-spaces", code: "IND_COWORKING", keywords: "flex office, hot desk, shared office" },

  // Healthcare & Life Sciences
  { name: "Healthcare & HealthTech", slug: "healthcare-healthtech", code: "IND_HEALTHTECH", isPopular: true, keywords: "telemedicine, digital health, clinics" },
  { name: "Pharmaceuticals & Generics", slug: "pharmaceuticals", code: "IND_PHARMA", keywords: "drugs, formulations, clinical trials" },
  { name: "Biotechnology & Genomics", slug: "biotech", code: "IND_BIOTECH", keywords: "genomics, bio-engineering, research" },
  { name: "Medical Devices & MedTech", slug: "medtech", code: "IND_MEDTECH", keywords: "diagnostic equipment, implants, devices" },
  { name: "Hospitals & Diagnostics", slug: "hospitals", code: "IND_HOSPITALS", keywords: "patient care, nursing, medical centers" },
  { name: "Mental Health & Wellness", slug: "mental-health", code: "IND_MENTAL_HEALTH", keywords: "therapy, wellness apps, meditation" },
  { name: "Ayurveda & Alternative Medicine", slug: "ayurveda-wellness", code: "IND_AYURVEDA", keywords: "herbal, homeopathy, holistic health" },

  // Consumer & Retail
  { name: "E-Commerce & Digital Marketplaces", slug: "ecommerce", code: "IND_ECOMMERCE", isPopular: true, keywords: "online store, d2c, retail platform" },
  { name: "Direct-to-Consumer (D2C) Brands", slug: "d2c-brands", code: "IND_D2C", isPopular: true, keywords: "consumer brands, online retail, lifestyle" },
  { name: "FMCG & Fast-Moving Consumer Goods", slug: "fmcg", code: "IND_FMCG", keywords: "packaged goods, food, personal care" },
  { name: "Retail, Supermarkets & Wholesale", slug: "retail-wholesale", code: "IND_RETAIL", keywords: "brick-and-mortar, distribution, storefronts" },
  { name: "Apparel, Fashion & Luxury", slug: "fashion-beauty", code: "IND_FASHION", keywords: "clothing, cosmetics, personal care" },
  { name: "Food & Beverage (F&B)", slug: "food-beverage", code: "IND_FOOD_BEV", keywords: "restaurants, cafes, packaged food" },
  { name: "FoodTech, Quick-Commerce & Cloud Kitchens", slug: "foodtech", code: "IND_FOODTECH", keywords: "delivery apps, ghost kitchens, q-commerce" },
  { name: "Footwear & Leather Products", slug: "footwear-leather", code: "IND_FOOTWEAR", keywords: "shoes, leather goods, tanneries" },

  // Manufacturing & Mobility
  { name: "Manufacturing & Heavy Engineering", slug: "manufacturing", code: "IND_MANUFACTURING", keywords: "factories, machinery, production" },
  { name: "Automotive & Electric Vehicles (EV)", slug: "automotive-ev", code: "IND_EV", isPopular: true, keywords: "mobility, clean transport, battery tech" },
  { name: "Aerospace, Aviation & SpaceTech", slug: "aerospace-defense", code: "IND_AEROSPACE", keywords: "aviation, defense systems, space technology" },
  { name: "Logistics, Supply Chain & Freight", slug: "logistics-supplychain", code: "IND_LOGISTICS", isPopular: true, keywords: "freight, warehousing, last-mile delivery" },
  { name: "Warehousing & Third-Party Logistics (3PL)", slug: "warehousing", code: "IND_WAREHOUSING", keywords: "storage, fulfillment, inventory" },
  { name: "Chemicals, Petrochemicals & Materials", slug: "chemicals", code: "IND_CHEMICALS", keywords: "polymers, specialty chemicals, industrial" },
  { name: "Textiles, Fabrics & Garments", slug: "textiles", code: "IND_TEXTILES", keywords: "fabrics, weaving, garment manufacturing" },
  { name: "Maritime, Shipping & Ports", slug: "maritime-shipping", code: "IND_MARITIME", keywords: "cargo ships, ports, sea freight" },
  { name: "Railways & Urban Transit", slug: "railways-transit", code: "IND_RAILWAYS", keywords: "metro rail, locomotives, transit" },

  // Energy & Environment
  { name: "Renewable Energy, Solar & CleanTech", slug: "cleantech-energy", code: "IND_CLEANTECH", isPopular: true, keywords: "solar, wind, sustainability, green tech" },
  { name: "Oil, Gas & Fossil Energy", slug: "oil-gas", code: "IND_OIL_GAS", keywords: "petroleum, natural gas, power generation" },
  { name: "Environmental Services & Recycling", slug: "environmental-services", code: "IND_ENVIR", keywords: "recycling, waste management, carbon capture" },
  { name: "Agriculture, AgriTech & Farming", slug: "agritech", code: "IND_AGRITECH", isPopular: true, keywords: "farming, crop tech, organic, dairy" },
  { name: "Water Management & Purification", slug: "water-mgmt", code: "IND_WATER", keywords: "desalination, purification, sewage" },
  { name: "Mining, Metals & Minerals", slug: "mining-metals", code: "IND_MINING", keywords: "iron ore, steel, coal, mining ops" },

  // Education & HR
  { name: "Education, EdTech & E-Learning", slug: "education-edtech", code: "IND_EDTECH", isPopular: true, keywords: "online learning, K-12, higher ed, skill development" },
  { name: "Human Resources & HRTech", slug: "hr-hrtech", code: "IND_HRTECH", keywords: "recruitment, staffing, payroll software" },
  { name: "Corporate Upskilling & Executive Coaching", slug: "corporate-training", code: "IND_TRAINING", keywords: "upskilling, leadership development" },

  // Media, Entertainment & Creative
  { name: "Media, Publishing & Digital News", slug: "media-publishing", code: "IND_MEDIA", keywords: "journalism, digital media, broadcasting" },
  { name: "Gaming, Esports & Interactive Media", slug: "gaming-entertainment", code: "IND_GAMING", isPopular: true, keywords: "video games, streaming, film, music" },
  { name: "Creator Economy, Influencers & Social Platforms", slug: "creator-economy", code: "IND_CREATOR", isPopular: true, keywords: "influencer, content creation, social platforms" },
  { name: "Advertising, PR & Marketing Agencies", slug: "advertising-adtech", code: "IND_ADTECH", keywords: "agency, campaigns, programmatic ads" },
  { name: "Events, Conferences & Exhibitions", slug: "events-exhibitions", code: "IND_EVENTS", keywords: "event management, trade shows, ticketing" },
  { name: "Animation, VFX & CGI Studios", slug: "animation-vfx", code: "IND_VFX", keywords: "special effects, 3d animation, film post" },
  { name: "Music, Audio & Podcast Industry", slug: "music-podcasting", code: "IND_MUSIC", keywords: "music labels, streaming, podcasts" },

  // Professional Services & Governance
  { name: "Management, Strategy & IT Consulting", slug: "management-consulting-ind", code: "IND_CONSULTING", isPopular: true, keywords: "strategy, advisory, operations consulting" },
  { name: "Legal Services & LegalTech", slug: "legal-services-ind", code: "IND_LEGALTECH", keywords: "law firms, compliance, contract automation" },
  { name: "BPO, KPO & Customer Support Services", slug: "bpo-kpo", code: "IND_BPO", keywords: "outsourcing, call centers, process management" },
  { name: "Nonprofit, NGO & Social Impact Enterprises", slug: "nonprofit-ngo", code: "IND_NGO", keywords: "social work, charity, foundation" },
  { name: "Government, Defense & Civic Tech", slug: "government-public", code: "IND_GOVT", keywords: "civic tech, public policy, defense" },
  { name: "Travel, Aviation & Tourism", slug: "travel-hospitality", code: "IND_TRAVEL", keywords: "hotels, booking, airlines, traveltech" },
  { name: "Hospitality & Restaurant Chains", slug: "hospitality-restaurants", code: "IND_HOSPITALITY", keywords: "dining, resorts, QSR" },
  { name: "Sports, Fitness & GymTech", slug: "sports-fitness", code: "IND_SPORTS", keywords: "athletics, wearables, gym chains" },
  { name: "Pet Care, Veterinary & PetTech", slug: "pet-care", code: "IND_PET_CARE", keywords: "pet food, vet clinics, grooming" },
  { name: "Packaging, Printing & Box Manufacturing", slug: "packaging-printing", code: "IND_PACKAGING", keywords: "corrugated boxes, printing press, labels" },
  { name: "Furniture, Home Decor & Furnishings", slug: "furniture-home", code: "IND_FURNITURE", keywords: "sofas, office desks, decor" },
  { name: "Jewellery, Gems & Luxury Goods", slug: "jewellery-gems", code: "IND_JEWELLERY", keywords: "gold, diamonds, luxury watches" },
  { name: "Franchising & Multi-Unit Retail", slug: "franchising", code: "IND_FRANCHISE", keywords: "franchise brand, master franchisee" },
  { name: "Religious & Spiritual Organizations", slug: "religious-services", code: "IND_RELIGIOUS", keywords: "ashrams, spiritual centers, pilgrimage" },
  { name: "Handicrafts, Artisans & Cultural Heritage", slug: "handicrafts-art", code: "IND_HANDICRAFTS", keywords: "handloom, pottery, traditional art" }
];
