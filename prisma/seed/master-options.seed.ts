export interface RawMasterOption {
  type: string;
  label: string;
  value: string;
  min?: number;
  max?: number;
  groupKey?: string;
  sortOrder?: number;
  metadata?: any;
}

export const RAW_MASTER_OPTIONS: RawMasterOption[] = [
  // Company Size
  { type: "company_size", label: "Self-employed / Just Me", value: "1", min: 1, max: 1, sortOrder: 1 },
  { type: "company_size", label: "2–10 employees", value: "2-10", min: 2, max: 10, sortOrder: 2 },
  { type: "company_size", label: "11–50 employees", value: "11-50", min: 11, max: 50, sortOrder: 3 },
  { type: "company_size", label: "51–200 employees", value: "51-200", min: 51, max: 200, sortOrder: 4 },
  { type: "company_size", label: "201–500 employees", value: "201-500", min: 201, max: 500, sortOrder: 5 },
  { type: "company_size", label: "501–1,000 employees", value: "501-1000", min: 501, max: 1000, sortOrder: 6 },
  { type: "company_size", label: "1,001–5,000 employees", value: "1001-5000", min: 1001, max: 5000, sortOrder: 7 },
  { type: "company_size", label: "5,001–10,000 employees", value: "5001-10000", min: 5001, max: 10000, sortOrder: 8 },
  { type: "company_size", label: "10,001+ employees", value: "10001+", min: 10001, max: 999999, sortOrder: 9 },

  // Experience Level
  { type: "experience_level", label: "Fresher / Trainee", value: "Fresher", sortOrder: 1 },
  { type: "experience_level", label: "Entry Level (0-2 yrs)", value: "Entry Level", sortOrder: 2 },
  { type: "experience_level", label: "Junior (1-3 yrs)", value: "Junior", sortOrder: 3 },
  { type: "experience_level", label: "Intermediate / Mid-Level (3-5 yrs)", value: "Intermediate", sortOrder: 4 },
  { type: "experience_level", label: "Senior (5-8 yrs)", value: "Senior", sortOrder: 5 },
  { type: "experience_level", label: "Lead / Manager (8-12 yrs)", value: "Lead", sortOrder: 6 },
  { type: "experience_level", label: "Expert / Principal (12+ yrs)", value: "Expert", sortOrder: 7 },

  // Experience Ranges
  { type: "experience_range", label: "Less than 1 Year", value: "<1", min: 0, max: 1, sortOrder: 1 },
  { type: "experience_range", label: "1–2 Years", value: "1-2", min: 1, max: 2, sortOrder: 2 },
  { type: "experience_range", label: "2–3 Years", value: "2-3", min: 2, max: 3, sortOrder: 3 },
  { type: "experience_range", label: "3–5 Years", value: "3-5", min: 3, max: 5, sortOrder: 4 },
  { type: "experience_range", label: "5–7 Years", value: "5-7", min: 5, max: 7, sortOrder: 5 },
  { type: "experience_range", label: "7–10 Years", value: "7-10", min: 7, max: 10, sortOrder: 6 },
  { type: "experience_range", label: "10–15 Years", value: "10-15", min: 10, max: 15, sortOrder: 7 },
  { type: "experience_range", label: "15–20 Years", value: "15-20", min: 15, max: 20, sortOrder: 8 },
  { type: "experience_range", label: "20+ Years", value: "20+", min: 20, max: 99, sortOrder: 9 },

  // Startup Stages (11)
  { type: "startup_stage", label: "Idea Stage", value: "Idea Stage", sortOrder: 1 },
  { type: "startup_stage", label: "Concept & Problem Validation", value: "Concept Stage", sortOrder: 2 },
  { type: "startup_stage", label: "Research & Feasibility", value: "Research Stage", sortOrder: 3 },
  { type: "startup_stage", label: "Prototype / Wireframes", value: "Prototype", sortOrder: 4 },
  { type: "startup_stage", label: "MVP Development", value: "MVP Development", sortOrder: 5 },
  { type: "startup_stage", label: "MVP Launched / Beta Testing", value: "MVP Launched", sortOrder: 6 },
  { type: "startup_stage", label: "Pre-Revenue / Early Users", value: "Pre-Revenue", sortOrder: 7 },
  { type: "startup_stage", label: "Early Revenue & Product-Market Fit", value: "Early Revenue", sortOrder: 8 },
  { type: "startup_stage", label: "Growth & Expansion", value: "Growth", sortOrder: 9 },
  { type: "startup_stage", label: "Scaling & Market Leader", value: "Scaling", sortOrder: 10 },
  { type: "startup_stage", label: "Profitable & Mature", value: "Profitable", sortOrder: 11 },
  { type: "startup_stage", label: "Pre-Exit / M&A", value: "Pre-Exit", sortOrder: 12 },

  // Funding Stages (12)
  { type: "funding_stage", label: "Bootstrapped / Self-Funded", value: "Bootstrapped", sortOrder: 1 },
  { type: "funding_stage", label: "Friends & Family", value: "Friends & Family", sortOrder: 2 },
  { type: "funding_stage", label: "Angel Round", value: "Angel", sortOrder: 3 },
  { type: "funding_stage", label: "Pre-Seed Round", value: "Pre-Seed", sortOrder: 4 },
  { type: "funding_stage", label: "Seed Round", value: "Seed", sortOrder: 5 },
  { type: "funding_stage", label: "Bridge / Convertible Note", value: "Bridge", sortOrder: 6 },
  { type: "funding_stage", label: "Series A Round", value: "Series A", sortOrder: 7 },
  { type: "funding_stage", label: "Series B Round", value: "Series B", sortOrder: 8 },
  { type: "funding_stage", label: "Series C+ Round", value: "Series C+", sortOrder: 9 },
  { type: "funding_stage", label: "Venture Debt", value: "Venture Debt", sortOrder: 10 },
  { type: "funding_stage", label: "Strategic Investment", value: "Strategic Investment", sortOrder: 11 },
  { type: "funding_stage", label: "Private Equity", value: "Private Equity", sortOrder: 12 },

  // Startup Goals (Expanded 45+)
  { type: "startup_goal", label: "Funding / Investment", value: "Funding / Investment", sortOrder: 1 },
  { type: "startup_goal", label: "Angel Investor Connect", value: "Angel Investor", sortOrder: 2 },
  { type: "startup_goal", label: "Venture Capital Connect", value: "Venture Capital", sortOrder: 3 },
  { type: "startup_goal", label: "Strategic Investor", value: "Strategic Investor", sortOrder: 4 },
  { type: "startup_goal", label: "Technical Co-Founder", value: "Technical Co-Founder", sortOrder: 5 },
  { type: "startup_goal", label: "Business Co-Founder", value: "Business Co-Founder", sortOrder: 6 },
  { type: "startup_goal", label: "Marketing Co-Founder", value: "Marketing Co-Founder", sortOrder: 7 },
  { type: "startup_goal", label: "Operations Co-Founder", value: "Operations Co-Founder", sortOrder: 8 },
  { type: "startup_goal", label: "Team Building & Core Hires", value: "Team Building", sortOrder: 9 },
  { type: "startup_goal", label: "Hire Freelancers & Contractors", value: "Hire Freelancers", sortOrder: 10 },
  { type: "startup_goal", label: "Hire Strategic Consultants", value: "Hire Consultants", sortOrder: 11 },
  { type: "startup_goal", label: "Mentorship & Advisory", value: "Mentorship", sortOrder: 12 },
  { type: "startup_goal", label: "Business Partnerships", value: "Business Partners", sortOrder: 13 },
  { type: "startup_goal", label: "Strategic Partnerships", value: "Strategic Partnerships", sortOrder: 14 },
  { type: "startup_goal", label: "Distribution & Channel Partners", value: "Distribution Partners", sortOrder: 15 },
  { type: "startup_goal", label: "Technology Partners", value: "Technology Partners", sortOrder: 16 },
  { type: "startup_goal", label: "Market Connect & B2B Leads", value: "Market Connect", sortOrder: 17 },
  { type: "startup_goal", label: "Customer Acquisition", value: "Customer Acquisition", sortOrder: 18 },
  { type: "startup_goal", label: "Lead Generation", value: "Lead Generation", sortOrder: 19 },
  { type: "startup_goal", label: "Sales Growth & Pipeline", value: "Sales Growth", sortOrder: 20 },
  { type: "startup_goal", label: "Digital Marketing Strategy", value: "Marketing", sortOrder: 21 },
  { type: "startup_goal", label: "Branding & PR", value: "Branding", sortOrder: 22 },
  { type: "startup_goal", label: "Product Development", value: "Product Development", sortOrder: 23 },
  { type: "startup_goal", label: "MVP Development", value: "MVP Development", sortOrder: 24 },
  { type: "startup_goal", label: "Technology Architecture", value: "Technology Development", sortOrder: 25 },
  { type: "startup_goal", label: "UI/UX Redesign", value: "UI/UX", sortOrder: 26 },
  { type: "startup_goal", label: "Business Strategy", value: "Business Strategy", sortOrder: 27 },
  { type: "startup_goal", label: "Financial Planning & Modeling", value: "Financial Planning", sortOrder: 28 },
  { type: "startup_goal", label: "Legal Support & Contracts", value: "Legal Support", sortOrder: 29 },
  { type: "startup_goal", label: "Compliance & Regulatory Audit", value: "Compliance", sortOrder: 30 },
  { type: "startup_goal", label: "Accounting & Tax Filing", value: "Accounting", sortOrder: 31 },
  { type: "startup_goal", label: "Intellectual Property / Patents", value: "Intellectual Property", sortOrder: 32 },
  { type: "startup_goal", label: "International Expansion", value: "International Expansion", sortOrder: 33 },
  { type: "startup_goal", label: "Domestic Expansion", value: "Domestic Expansion", sortOrder: 34 },
  { type: "startup_goal", label: "Incubation / Acceleration Support", value: "Incubation", sortOrder: 35 },
  { type: "startup_goal", label: "Pitch Deck Preparation", value: "Pitch Preparation", sortOrder: 36 },
  { type: "startup_goal", label: "Product-Market Fit Validation", value: "Product-Market Fit", sortOrder: 37 },

  // Investor Types (Expanded 25+)
  { type: "investor_type", label: "Individual Investor", value: "Individual Investor", sortOrder: 1 },
  { type: "investor_type", label: "Angel Investor", value: "Angel Investor", sortOrder: 2 },
  { type: "investor_type", label: "Super Angel", value: "Super Angel", sortOrder: 3 },
  { type: "investor_type", label: "High-Net-Worth Individual (HNI)", value: "HNI Investor", sortOrder: 4 },
  { type: "investor_type", label: "Non-Resident Indian (NRI) Investor", value: "NRI Investor", sortOrder: 5 },
  { type: "investor_type", label: "Angel Network", value: "Angel Network", sortOrder: 6 },
  { type: "investor_type", label: "Syndicate Lead", value: "Syndicate Investor", sortOrder: 7 },
  { type: "investor_type", label: "Micro VC", value: "Micro VC", sortOrder: 8 },
  { type: "investor_type", label: "Venture Capital (VC)", value: "Venture Capital", sortOrder: 9 },
  { type: "investor_type", label: "Corporate VC (CVC)", value: "Corporate VC", sortOrder: 10 },
  { type: "investor_type", label: "Private Equity (PE)", value: "Private Equity", sortOrder: 11 },
  { type: "investor_type", label: "Family Office", value: "Family Office", sortOrder: 12 },
  { type: "investor_type", label: "Institutional Investor", value: "Institutional Investor", sortOrder: 13 },
  { type: "investor_type", label: "Corporate Investor", value: "Corporate Investor", sortOrder: 14 },
  { type: "investor_type", label: "Strategic Investor", value: "Strategic Investor", sortOrder: 15 },
  { type: "investor_type", label: "Impact Investor", value: "Impact Investor", sortOrder: 16 },
  { type: "investor_type", label: "Debt Investor / Fund", value: "Debt Investor", sortOrder: 17 },
  { type: "investor_type", label: "Venture Debt Fund", value: "Venture Debt Fund", sortOrder: 18 },
  { type: "investor_type", label: "Government / State Fund", value: "Government Fund", sortOrder: 19 },
  { type: "investor_type", label: "Fund of Funds", value: "Fund of Funds", sortOrder: 20 },
  { type: "investor_type", label: "Accelerator Fund", value: "Accelerator", sortOrder: 21 },
  { type: "investor_type", label: "Incubator Fund", value: "Incubator", sortOrder: 22 },
  { type: "investor_type", label: "Working Partner Investor", value: "Working Partner", sortOrder: 23 },
  { type: "investor_type", label: "Sleeping Partner Investor", value: "Sleeping Partner", sortOrder: 24 },
  { type: "investor_type", label: "Mentor Investor", value: "Mentor Investor", sortOrder: 25 },

  // Investment Types (Expanded 20+)
  { type: "investment_type", label: "Equity Round", value: "Equity", sortOrder: 1 },
  { type: "investment_type", label: "Debt Investment", value: "Debt", sortOrder: 2 },
  { type: "investment_type", label: "Convertible Note", value: "Convertible Note", sortOrder: 3 },
  { type: "investment_type", label: "SAFE (Simple Agreement)", value: "SAFE", sortOrder: 4 },
  { type: "investment_type", label: "Venture Debt", value: "Venture Debt", sortOrder: 5 },
  { type: "investment_type", label: "Revenue-Based Financing", value: "Revenue-Based Financing", sortOrder: 6 },
  { type: "investment_type", label: "Revenue Share Agreement", value: "Revenue Share", sortOrder: 7 },
  { type: "investment_type", label: "Profit Sharing Investment", value: "Profit Share", sortOrder: 8 },
  { type: "investment_type", label: "Angel Seed Capital", value: "Angel Investment", sortOrder: 9 },
  { type: "investment_type", label: "Seed Capital", value: "Seed Capital", sortOrder: 10 },
  { type: "investment_type", label: "Growth Capital", value: "Growth Capital", sortOrder: 11 },
  { type: "investment_type", label: "Private Equity Stake", value: "Private Equity", sortOrder: 12 },
  { type: "investment_type", label: "Strategic Investment", value: "Strategic Investment", sortOrder: 13 },
  { type: "investment_type", label: "Working Partnership", value: "Working Partnership", sortOrder: 14 },
  { type: "investment_type", label: "Sleeping Partnership", value: "Sleeping Partnership", sortOrder: 15 },
  { type: "investment_type", label: "Joint Venture (JV)", value: "Joint Venture", sortOrder: 16 },
  { type: "investment_type", label: "Acquisition Buyout", value: "Acquisition", sortOrder: 17 },
  { type: "investment_type", label: "Franchise Investment", value: "Franchise Investment", sortOrder: 18 },

  // Founder Types (Expanded 18+)
  { type: "founder_type", label: "Startup Founder", value: "Startup Founder", sortOrder: 1 },
  { type: "founder_type", label: "Co-Founder", value: "Co-Founder", sortOrder: 2 },
  { type: "founder_type", label: "Idea Creator / Innovator", value: "Idea Creator", sortOrder: 3 },
  { type: "founder_type", label: "Entrepreneur", value: "Entrepreneur", sortOrder: 4 },
  { type: "founder_type", label: "Solo Founder", value: "Solo Founder", sortOrder: 5 },
  { type: "founder_type", label: "Technical Founder", value: "Technical Founder", sortOrder: 6 },
  { type: "founder_type", label: "Non-Technical Founder", value: "Non-Technical Founder", sortOrder: 7 },
  { type: "founder_type", label: "Business / Commercial Founder", value: "Business Founder", sortOrder: 8 },
  { type: "founder_type", label: "Product Founder", value: "Product Founder", sortOrder: 9 },
  { type: "founder_type", label: "Student Founder", value: "Student Founder", sortOrder: 10 },
  { type: "founder_type", label: "Academic / Research Founder", value: "Research Founder", sortOrder: 11 },
  { type: "founder_type", label: "Professional Founder", value: "Professional Founder", sortOrder: 12 },
  { type: "founder_type", label: "First-Time Founder", value: "First-Time Founder", sortOrder: 13 },
  { type: "founder_type", label: "Serial Entrepreneur", value: "Serial Entrepreneur", sortOrder: 14 },
  { type: "founder_type", label: "Social Entrepreneur", value: "Social Entrepreneur", sortOrder: 15 },
  { type: "founder_type", label: "Founder Seeking Investment", value: "Founder Seeking Investment", sortOrder: 16 },
  { type: "founder_type", label: "Founder Seeking Co-Founder", value: "Founder Seeking Co-Founder", sortOrder: 17 },

  // Business Types (Expanded 30+)
  { type: "business_type", label: "Individual / Freelancer", value: "Individual", sortOrder: 1 },
  { type: "business_type", label: "Independent Contractor", value: "Freelancer", sortOrder: 2 },
  { type: "business_type", label: "Sole Proprietorship", value: "Sole Proprietorship", sortOrder: 3 },
  { type: "business_type", label: "Partnership Firm", value: "Partnership", sortOrder: 4 },
  { type: "business_type", label: "Limited Liability Partnership (LLP)", value: "LLP", sortOrder: 5 },
  { type: "business_type", label: "One Person Company (OPC)", value: "OPC", sortOrder: 6 },
  { type: "business_type", label: "Private Limited Company (Pvt Ltd)", value: "Private Limited", sortOrder: 7 },
  { type: "business_type", label: "Public Limited Company", value: "Public Limited", sortOrder: 8 },
  { type: "business_type", label: "DPIIT Registered Startup", value: "Startup", sortOrder: 9 },
  { type: "business_type", label: "MSME Registered Enterprise", value: "MSME", sortOrder: 10 },
  { type: "business_type", label: "Enterprise Corporation", value: "Enterprise", sortOrder: 11 },
  { type: "business_type", label: "Agency / Studio", value: "Agency", sortOrder: 12 },
  { type: "business_type", label: "Management Consulting Firm", value: "Consulting Firm", sortOrder: 13 },
  { type: "business_type", label: "Professional Services Firm", value: "Professional Services", sortOrder: 14 },
  { type: "business_type", label: "SaaS Business", value: "SaaS Business", sortOrder: 15 },
  { type: "business_type", label: "D2C Brand", value: "D2C Brand", sortOrder: 16 },
  { type: "business_type", label: "E-Commerce Business", value: "E-Commerce Business", sortOrder: 17 },
  { type: "business_type", label: "Digital Marketplace", value: "Marketplace", sortOrder: 18 },
  { type: "business_type", label: "Retail Chain / Storefront", value: "Retailer", sortOrder: 19 },
  { type: "business_type", label: "Wholesaler / Distributor", value: "Wholesaler", sortOrder: 20 },
  { type: "business_type", label: "Manufacturer", value: "Manufacturer", sortOrder: 21 },
  { type: "business_type", label: "Importer / Exporter", value: "Importer", sortOrder: 22 },
  { type: "business_type", label: "Franchise Chain", value: "Franchise", sortOrder: 23 },

  // Project Types (Expanded 15+)
  { type: "project_type", label: "Fixed Price Project", value: "Fixed Price", sortOrder: 1 },
  { type: "project_type", label: "Hourly Contract", value: "Hourly", sortOrder: 2 },
  { type: "project_type", label: "Milestone-Based Project", value: "Milestone-Based", sortOrder: 3 },
  { type: "project_type", label: "Monthly Retainer", value: "Retainer", sortOrder: 4 },
  { type: "project_type", label: "Dedicated Resource / Staff Augmentation", value: "Dedicated Resource", sortOrder: 5 },
  { type: "project_type", label: "Strategic Consulting", value: "Consulting", sortOrder: 6 },
  { type: "project_type", label: "Short-Term Advisory (<1 mo)", value: "Short-Term", sortOrder: 7 },
  { type: "project_type", label: "Long-Term Engagement (3-6+ mo)", value: "Long-Term", sortOrder: 8 },
  { type: "project_type", label: "Part-Time Contract", value: "Part-Time", sortOrder: 9 },
  { type: "project_type", label: "Full-Time Contract", value: "Full-Time Contract", sortOrder: 10 },
  { type: "project_type", label: "Ongoing Technical Support", value: "Ongoing Support", sortOrder: 11 },
  { type: "project_type", label: "Maintenance & SLA", value: "Maintenance", sortOrder: 12 },
  { type: "project_type", label: "One-Time Audit / Inspection", value: "One-Time Project", sortOrder: 13 },
  { type: "project_type", label: "Managed Service Delivery", value: "Managed Service", sortOrder: 14 },

  // Availability Options (Expanded 15+)
  { type: "availability", label: "Immediately Available (Full-Time)", value: "Immediately Available", sortOrder: 1 },
  { type: "availability", label: "Within 3 Days", value: "Within 3 Days", sortOrder: 2 },
  { type: "availability", label: "Within 1 Week", value: "Within 1 Week", sortOrder: 3 },
  { type: "availability", label: "1–2 Weeks Notice", value: "1-2 Weeks", sortOrder: 4 },
  { type: "availability", label: "2–4 Weeks Notice", value: "2-4 Weeks", sortOrder: 5 },
  { type: "availability", label: "1 Month Notice", value: "1 Month", sortOrder: 6 },
  { type: "availability", label: "2 Months Notice", value: "2 Months", sortOrder: 7 },
  { type: "availability", label: "3+ Months Notice", value: "3+ Months", sortOrder: 8 },
  { type: "availability", label: "Part-Time (10-20 hrs/week)", value: "Part-Time", sortOrder: 9 },
  { type: "availability", label: "Full-Time (40 hrs/week)", value: "Full-Time", sortOrder: 10 },
  { type: "availability", label: "Weekdays Only", value: "Weekdays", sortOrder: 11 },
  { type: "availability", label: "Weekends Only", value: "Weekends", sortOrder: 12 },
  { type: "availability", label: "Evenings Only (IST / EST)", value: "Evenings", sortOrder: 13 },
  { type: "availability", label: "Flexible Working Hours", value: "Flexible", sortOrder: 14 },
  { type: "availability", label: "Not Currently Available", value: "Not Currently Available", sortOrder: 15 },

  // Investment Ranges / Ticket Sizes (INR)
  { type: "ticket_size", label: "Below ₹1 Lakh", value: "<1L", min: 0, max: 100000, sortOrder: 1 },
  { type: "ticket_size", label: "₹1–5 Lakhs", value: "1L-5L", min: 100000, max: 500000, sortOrder: 2 },
  { type: "ticket_size", label: "₹5–10 Lakhs", value: "5L-10L", min: 500000, max: 1000000, sortOrder: 3 },
  { type: "ticket_size", label: "₹10–25 Lakhs", value: "10L-25L", min: 1000000, max: 2500000, sortOrder: 4 },
  { type: "ticket_size", label: "₹25–50 Lakhs", value: "25L-50L", min: 2500000, max: 5000000, sortOrder: 5 },
  { type: "ticket_size", label: "₹50 Lakhs–₹1 Crore", value: "50L-1Cr", min: 5000000, max: 10000000, sortOrder: 6 },
  { type: "ticket_size", label: "₹1–2 Crores", value: "1Cr-2Cr", min: 10000000, max: 20000000, sortOrder: 7 },
  { type: "ticket_size", label: "₹2–5 Crores", value: "2Cr-5Cr", min: 20000000, max: 50000000, sortOrder: 8 },
  { type: "ticket_size", label: "₹5–10 Crores", value: "5Cr-10Cr", min: 50000000, max: 100000000, sortOrder: 9 },
  { type: "ticket_size", label: "₹10–25 Crores", value: "10Cr-25Cr", min: 100000000, max: 250000000, sortOrder: 10 },
  { type: "ticket_size", label: "₹25–50 Crores", value: "25Cr-50Cr", min: 250000000, max: 500000000, sortOrder: 11 },
  { type: "ticket_size", label: "₹50–100 Crores", value: "50Cr-100Cr", min: 500000000, max: 1000000000, sortOrder: 12 },
  { type: "ticket_size", label: "₹100 Crores+", value: "100Cr+", min: 1000000000, max: 9999999999, sortOrder: 13 },
  { type: "ticket_size", label: "Flexible / Depends on Opportunity", value: "Flexible", min: 0, max: 0, sortOrder: 14 }
];

// Seed 36 States & Union Territories of India + 100+ Major Commercial Cities
const INDIA_STATES_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi (NCT)",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

for (const stateName of INDIA_STATES_UTS) {
  RAW_MASTER_OPTIONS.push({
    type: "state",
    label: stateName,
    value: stateName,
    groupKey: "India",
  });
}

const INDIA_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune", "Jaipur",
  "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna",
  "Vadodara", "Gaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli",
  "Vasai-Virar", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad",
  "Ranchi", "Howrah", "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur",
  "Kota", "Guwahati", "Chandigarh", "Solapur", "Hubli-Dharwad", "Bareilly", "Moradabad", "Mysore", "Gurgaon",
  "Noida", "Aligarh", "Jalandhar", "Tiruchirappalli", "Bhubaneswar", "Salem", "Mira-Bhayander", "Warangal",
  "Thiruvananthapuram", "Bhiwandi", "Saharanpur", "Guntur", "Amravati", "Bikaner", "Noida (Greater)",
  "Jamshedpur", "Bhilai", "Cuttack", "Firozabad", "Kochi", "Nellore", "Bhavnagar", "Dehradun", "Durgapur",
  "Asansol", "Rourkela", "Nanded", "Kolhapur", "Ajmer", "Gulbarga", "Jamnagar", "Ujjain", "Loni",
  "Siliguri", "Jhansi", "Ulhasnagar", "Jammu", "Sangli-Miraj", "Mangalore", "Erode", "Belgaum", "Ambattur",
  "Tirunelveli", "Malegaon", "Gaya", "Udaipur", "Kakinada", "Davanagere", "Kozhikode", "Akola", "Rajpur Sonarpur"
];

for (const cityName of INDIA_CITIES) {
  RAW_MASTER_OPTIONS.push({
    type: "city",
    label: cityName,
    value: cityName,
    groupKey: "India",
  });
}
