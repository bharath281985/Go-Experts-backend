const mongoose = require('mongoose');
require('dotenv').config();
const StaticPage = require('./models/StaticPage');

const pages = [
  {
    title: 'Terms of Service',
    slug: 'terms',
    status: 'published',
    content: `
      <h2>1. Acceptance of Terms</h2>
      <p>By using Go Experts, you agree to these Terms of Service. Please read them carefully before using our platform.</p>
      <h2>2. User Accounts</h2>
      <p>You are responsible for maintaining the security of your account. Go Experts reserves the right to terminate accounts that violate our policies.</p>
      <h2>3. Platform Fees</h2>
      <p>Go Experts charges a service fee on completed transactions. Fees are displayed before purchase confirmation.</p>
      <h2>4. Dispute Resolution</h2>
      <p>Disputes between clients and freelancers must be submitted through our resolution center within 30 days.</p>
      <h2>5. Governing Law</h2>
      <p>These terms are governed by the laws of India. Any disputes will be subject to the exclusive jurisdiction of the courts in New Delhi.</p>
    `,
    meta_title: 'Terms of Service | Go Experts',
    meta_description: 'Read the terms and conditions for using the Go Experts freelancer platform.'
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    status: 'published',
    content: `
      <h2>Information We Collect</h2>
      <p>We collect information you provide when creating an account, posting projects, or communicating through our platform.</p>
      <h2>How We Use Your Information</h2>
      <p>Your information is used to provide and improve our services, process payments, and communicate with you about your account.</p>
      <h2>Data Security</h2>
      <p>We implement industry-standard encryption and security practices to protect your personal information.</p>
      <h2>Your Rights</h2>
      <p>You have the right to access, update, or delete your personal information at any time through your account settings.</p>
      <h2>Contact Us</h2>
      <p>If you have questions about our privacy policy, please contact us at privacy@goexperts.in.</p>
    `,
    meta_title: 'Privacy Policy | Go Experts',
    meta_description: 'Learn how Go Experts collects, uses, and protects your personal data.'
  },
  {
    title: 'Cookie Policy',
    slug: 'cookies',
    status: 'published',
    content: `
      <h2>What are Cookies?</h2>
      <p>Cookies are small text files stored on your device to help us provide a better experience. They allow us to remember your preferences and understand how you use our platform.</p>
      <h2>How We Use Cookies</h2>
      <ul>
        <li><strong>Essential Cookies:</strong> Required for the platform to function properly.</li>
        <li><strong>Analytical Cookies:</strong> Help us improve our services by understanding user behavior.</li>
        <li><strong>Preference Cookies:</strong> Remember your settings and choices.</li>
      </ul>
      <h2>Managing Cookies</h2>
      <p>You can manage cookie settings through your browser. Disabling certain cookies may affect platform functionality.</p>
    `,
    meta_title: 'Cookie Policy | Go Experts',
    meta_description: 'Our cookie policy explains how we use cookies to improve your experience on Go Experts.'
  },
  {
    title: 'About Us',
    slug: 'about-us',
    status: 'published',
    content: 'Go Experts is India’s fastest-growing freelance marketplace, built to empower talent and simplify hiring.',
    vision: 'To create a commission-free freelancing environment where talent and opportunity meet directly.',
    mission: 'To empower freelancers with full control over their earnings and help clients hire talent without hidden fees.',
    mission_points: [
      '100% Commission Free Model',
      'Direct Business Connections',
      'Secure & Verified Talent Pool',
      'Transparent Hiring Process'
    ],
    differentiators: [
      { label: 'Zero Commission', description: 'Freelancers keep 100% of their earnings with no hidden cuts.', icon: 'ShieldCheck' },
      { label: 'Verified Experts', description: 'Every freelancer on Go Experts undergoes a vetting process.', icon: 'CheckCircle' },
      { label: 'Direct Access', description: 'Connect with talent directly without middleman interference.', icon: 'Users' },
      { label: 'Secure Platform', description: 'Enterprise-grade security for your data and payments.', icon: 'Cpu' }
    ],
    responsibilities: 'We’re not just a platform—we’re a community where talent meets opportunity without barriers.',
    meta_title: 'About Go Experts | Our Mission & Vision',
    meta_description: 'Learn about Go Experts, the zero-commission freelance marketplace changing the future of work.'
  }
];

async function seedPages() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/go-experts';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    for (const pageData of pages) {
      await StaticPage.findOneAndUpdate(
        { slug: pageData.slug },
        pageData,
        { upsert: true, new: true }
      );
      console.log(`Seeded page: ${pageData.slug}`);
    }

    console.log('Static pages seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedPages();
