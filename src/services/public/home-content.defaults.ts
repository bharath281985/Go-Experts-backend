export const DEFAULT_HOME_CONTENT = {
  heroSlides: [
    {
      key: "freelancer",
      eyebrow: "For Freelancers",
      role: "Freelancers",
      title: "Find High Paying Projects With",
      titleHighlight: "Verified Clients",
      sub: "Connect with businesses worldwide and grow your freelance career on a network built for serious work.",
      primary: { label: "Join as Freelancer", to: "/signup/freelancer" },
      secondary: { label: "Browse Projects", to: "/post-project" },
      imageKey: "freelancer",
      alt: "Professional software developer coding on dual monitors in a modern studio",
    },
    {
      key: "client",
      eyebrow: "For Businesses",
      role: "Clients",
      title: "Hire Trusted Experts For",
      titleHighlight: "Every Business Need",
      sub: "Post a project and get matched with vetted freelancers, agencies and consultants in hours — not weeks.",
      primary: { label: "Post a Project", to: "/signup/client" },
      secondary: { label: "How It Works", to: "/how-it-works" },
      imageKey: "client",
      alt: "Business team planning a product roadmap with developers in a bright conference room",
    },
    {
      key: "investor",
      eyebrow: "For Investors",
      role: "Investors",
      title: "Discover Investment Opportunities",
      titleHighlight: "Before Everyone Else",
      sub: "Access a curated pipeline of vetted startups and revenue-generating businesses across sectors and stages.",
      primary: { label: "Explore Investments", to: "/signup/investor" },
      secondary: { label: "Meet Founders", to: "/founders" },
      imageKey: "investor",
      alt: "Investor reviewing a startup pitch deck alongside a portfolio analytics dashboard",
    },
    {
      key: "founder",
      eyebrow: "For Founders",
      role: "Startup Founders",
      title: "Turn Your Startup Idea Into",
      titleHighlight: "Reality",
      sub: "Share your idea. Meet investors, co-founders and world-class freelancers ready to help you build and scale.",
      primary: { label: "Submit Startup Idea", to: "/signup/founder" },
      secondary: { label: "See Startup Ideas", to: "/startup-ideas" },
      imageKey: "founder",
      alt: "Startup founder presenting a product roadmap on a whiteboard to a small team",
    },
  ],
  trustBadges: [
    { icon: "BadgeCheck", label: "Verified" },
    { icon: "Lock", label: "Secure Payments" },
    { icon: "Sparkles", label: "AI Powered" },
    { icon: "Headphones", label: "24x7 Support" },
  ],
  stats: [
    { value: "48k+", label: "Verified Freelancers", key: "freelancers" },
    { value: "12k+", label: "Active Clients", key: "clients" },
    { value: "3.2k+", label: "Startup Ideas", key: "startup_ideas" },
    { value: "1.8k+", label: "Investors", key: "investors" },
    { value: "62k+", label: "Projects Posted", key: "projects" },
  ],
  roles: [
    { key: "freelancer", icon: "Code2", title: "Freelancer", desc: "Join a verified network. Win serious clients and grow your rate.", cta: "Join as Freelancer", to: "/signup/freelancer" },
    { key: "client", icon: "Briefcase", title: "Client / Business", desc: "Post a project, hire matched experts, ship faster.", cta: "Post a Project", to: "/signup/client" },
    { key: "investor", icon: "Landmark", title: "Investor", desc: "Discover vetted startups and revenue-generating businesses.", cta: "Find Investments", to: "/signup/investor" },
    { key: "founder", icon: "Lightbulb", title: "Startup Founder", desc: "Share your idea. Meet investors, co-founders, and freelancers.", cta: "Submit Startup Idea", to: "/signup/founder" },
  ],
  howItWorks: [
    { icon: "Users", title: "Choose your role" },
    { icon: "Sparkles", title: "Complete profile" },
    { icon: "Search", title: "Discover opportunities" },
    { icon: "MessageSquare", title: "Connect & collaborate" },
    { icon: "Rocket", title: "Grow your business" },
  ],
  trustFeatures: [
    { icon: "BadgeCheck", title: "Verified profiles", description: "ID + skill verification for every professional." },
    { icon: "ShieldCheck", title: "Secure payments", description: "Milestone escrow with instant release on approval." },
    { icon: "MessageSquare", title: "Transparent comms", description: "Contracts, files, and messaging in one place." },
    { icon: "Wallet", title: "Global payouts", description: "Get paid in 90+ countries with local rails." },
  ],
  cta: {
    title: "Start Your Go Experts Journey Today",
    subtitle: "Join thousands of freelancers, clients, founders and investors building the future.",
    primaryLabel: "Join Now — Free",
    primaryTo: "/signup",
    secondaryLabel: "See how it works",
    secondaryTo: "/how-it-works",
  },
  sections: {
    roles: { eyebrow: "Choose your role", title: "One platform. Four ways to grow.", description: "Whether you're building a career, a company, a portfolio, or a fund — Go Experts is built for you." },
    howItWorks: { eyebrow: "How it works", title: "From signup to success in five steps." },
    categories: { eyebrow: "Explore", title: "Featured categories", description: "Talent across the disciplines modern businesses run on." },
    freelancers: { eyebrow: "Freelancer marketplace", title: "Hire the top 5%.", description: "Verified, ranked, and ready to work." },
    trust: { eyebrow: "Trust", title: "Built for serious work." },
    testimonials: { eyebrow: "Testimonials", title: "Loved by operators worldwide." },
    pricing: { eyebrow: "Pricing", title: "Simple plans for every role." },
    faq: { eyebrow: "FAQ", title: "Answers, upfront." },
  },
};

export function formatStatValue(count: number) {
  if (count >= 1000) {
    const rounded = Math.floor(count / 100) / 10;
    return `${rounded}k+`;
  }
  return `${count}+`;
}

export function slugifyCategory(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
