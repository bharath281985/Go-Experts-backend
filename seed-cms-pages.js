import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding CMS Pages...");

  const pages = [
    {
      name: "Privacy",
      title: "Privacy Policy",
      content: {
        title: "Privacy Policy",
        subtitle: "Learn how Go Experts collects, uses and protects your personal information.",
        version: "1.0",
        effectiveDate: "August 1, 2026",
        lastUpdated: new Date().toISOString().split('T')[0],
        contactEmail: "privacy@goexperts.in",
        contactUrl: "/contact",
        summary: "This Privacy Policy explains how we collect, use, and share your personal information.",
        sections: [
          {
            id: "information-collection",
            title: "Information Collection",
            content: "<p>We collect information you provide directly to us, such as when you create an account, update your profile, or use our services.</p>"
          }
        ],
        seo: {
          metaTitle: "Privacy Policy — Go Experts",
          metaDescription: "Learn how Go Experts collects, uses and protects your personal information."
        }
      }
    },
    {
      name: "Terms and conditions",
      title: "Terms & Conditions",
      content: {
        title: "Terms & Conditions",
        subtitle: "Please read our terms and conditions carefully.",
        version: "1.0",
        effectiveDate: "August 1, 2026",
        lastUpdated: new Date().toISOString().split('T')[0],
        contactEmail: "legal@goexperts.in",
        contactUrl: "/contact",
        summary: "These Terms & Conditions govern your use of the Go Experts platform.",
        sections: [
          {
            id: "acceptance",
            title: "Acceptance of Terms",
            content: "<p>By accessing or using Go Experts, you agree to be bound by these Terms & Conditions.</p>"
          }
        ],
        seo: {
          metaTitle: "Terms & Conditions — Go Experts",
          metaDescription: "Please read our terms and conditions carefully."
        }
      }
    },
    {
      name: "Refund Policy",
      title: "Refund Policy",
      content: {
        title: "Refund Policy",
        subtitle: "Our policies regarding refunds and cancellations.",
        version: "1.0",
        effectiveDate: "August 1, 2026",
        lastUpdated: new Date().toISOString().split('T')[0],
        contactEmail: "support@goexperts.in",
        contactUrl: "/contact",
        summary: "This policy outlines our procedures for refunds and cancellations.",
        sections: [
          {
            id: "refund-eligibility",
            title: "Refund Eligibility",
            content: "<p>Refunds are subject to our milestone-based escrow terms.</p>"
          }
        ],
        seo: {
          metaTitle: "Refund Policy — Go Experts",
          metaDescription: "Our policies regarding refunds and cancellations."
        }
      }
    },
    {
      name: "About",
      title: "About Us",
      content: {
        id: 1,
        title: "About Us",
        contentType: "html",
        htmlContent: "<div class=\"space-y-8 font-sans leading-relaxed text-slate-700\"><div class=\"text-center py-8\"><h1 class=\"text-4xl font-extrabold\">Working With You. For You.</h1></div></div>",
        hero: {
          enabled: true,
          eyebrow: "Our Story",
          heading: "Redefining Borderless Work",
          description: "We are on a mission to connect the world's top talent with visionary founders and investors.",
          primaryCtaLabel: "Join Us",
          primaryCtaUrl: "/sign-up"
        },
        team: [
          { name: "Kavya Rao", role: "CEO", bio: "Leading the vision." },
          { name: "Miles Turner", role: "CTO", bio: "Building the platform." }
        ],
        seo: {
          metaTitle: "About Us — Go Experts",
          metaDescription: "The story behind Go Experts."
        }
      }
    },
    {
      name: "Careers",
      title: "Careers",
      content: {
        hero: {
          eyebrow: "Careers",
          heading: "Build What's Next",
          description: "Explore open remote and hybrid positions at Go Experts.",
          primaryCtaLabel: "View Roles"
        },
        seo: {
          metaTitle: "Careers — Go Experts",
          metaDescription: "Join our global team."
        }
      }
    },
    {
      name: "Contact",
      title: "Contact Us",
      content: {
        hero: {
          eyebrow: "Contact",
          heading: "We're here to help",
          description: "Reach out to us for support, partnerships, or general inquiries.",
          email: "support@goexperts.in"
        },
        seo: {
          metaTitle: "Contact Us — Go Experts",
          metaDescription: "Get in touch with the Go Experts team."
        }
      }
    },
    {
      name: "Help Center",
      title: "Help Center",
      content: {
        hero: {
          eyebrow: "Support",
          heading: "How can we help you?",
          description: "Search our knowledge base for answers."
        },
        seo: {
          metaTitle: "Help Center — Go Experts",
          metaDescription: "Find answers and support."
        }
      }
    },
    {
      name: "FAQ",
      title: "Frequently Asked Questions",
      content: {
        hero: {
          eyebrow: "FAQ",
          heading: "Frequently Asked Questions",
          description: "Find answers to the most commonly asked questions."
        },
        seo: {
          metaTitle: "FAQ — Go Experts",
          metaDescription: "Answers to common questions."
        }
      }
    }
  ];

  for (const page of pages) {
    const payloadStr = JSON.stringify(page.content);
    const category = ['Privacy', 'Legal', 'Refund Policy', 'Terms and conditions'].includes(page.name) 
      ? 'legal' : 'general';

    await prisma.cmsPage.upsert({
      where: { name: page.name },
      update: {
        draftJson: payloadStr,
        publishedJson: payloadStr,
        content: payloadStr,
        category: category
      },
      create: {
        name: page.name,
        category: category,
        draftJson: payloadStr,
        publishedJson: payloadStr,
        content: payloadStr
      }
    }).catch(console.error);

    console.log(`✅ Upserted ${page.name}`);
  }

  console.log("Seeding complete.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
