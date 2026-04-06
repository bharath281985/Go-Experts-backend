const express = require('express');
const router = express.Router();
const {
    // Categories
    getCategories, getCategoryById, createCategory, updateCategory, deleteCategory, toggleCategory,
    // Skills
    getSkills, createSkill, updateSkill, deleteSkill, toggleSkill,
    // Site Settings
    getSiteSettings, getAdminSiteSettings, updateSiteSettings,
    // Banners
    getBanners, createBanner, updateBanner, deleteBanner, toggleBanner,
    // FAQs
    getFAQs, createFAQ, updateFAQ, deleteFAQ, toggleFAQ,
    // Static Pages
    getPages, getPageBySlug, createPage, updatePage, deletePage,
    // Menus
    getMenus, createMenuItem, updateMenuItem, deleteMenuItem, toggleMenuItem,
    // Registration Steps
    getRegistrationSteps, createRegistrationStep, updateRegistrationStep, deleteRegistrationStep, toggleRegistrationStep,
    bulkUpdateRegistrationSteps, resetRegistrationSteps,
    // Email Templates
    getEmailTemplates, updateEmailTemplate,
    // Testimonials
    getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, toggleTestimonial,
    uploadNDATemplate, uploadSiteLogo, uploadSiteFavicon, uploadHeaderLogo, uploadFooterLogo,
    // Startup Ideas Legal
    getStartupFAQs, createStartupFAQ, updateStartupFAQ, deleteStartupFAQ, toggleStartupFAQ,
    getStartupTerms, updateStartupTerms,
    getStartupPrivacy, updateStartupPrivacy
} = require('../controller/cmsController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// ── Public routes (website can read without auth) ──
router.get('/testimonials', getTestimonials); // Move to top to ensure public access
router.get('/categories', getCategories);
router.get('/categories/:id', getCategoryById);
router.get('/skills', getSkills);
router.get('/banners', getBanners);
router.get('/settings', getSiteSettings);
router.get('/faqs', getFAQs);
router.get('/pages/:slug', getPageBySlug);
router.get('/menus', getMenus);
router.get('/registration-steps', getRegistrationSteps);

// Startup Ideas Public
router.get('/startup/faqs', getStartupFAQs);
router.get('/startup/terms', getStartupTerms);
router.get('/startup/privacy', getStartupPrivacy);

// ── Admin-only routes ──
router.use(protect, authorize('admin'));

// Categories (admin)
router.post('/categories', upload.single('image'), createCategory);
router.put('/categories/:id', upload.single('image'), updateCategory);
router.delete('/categories/:id', deleteCategory);
router.patch('/categories/:id/toggle', toggleCategory);

// Skills (admin)
router.post('/skills', createSkill);
router.put('/skills/:id', updateSkill);
router.delete('/skills/:id', deleteSkill);
router.patch('/skills/:id/toggle', toggleSkill);

// Site Settings (admin only write)
router.get('/settings/admin', getAdminSiteSettings);
router.put('/settings', updateSiteSettings);
router.post('/settings/nda-template', upload.single('nda'), uploadNDATemplate);
router.post('/settings/logo', upload.single('site_logo'), uploadSiteLogo);
router.post('/settings/favicon', upload.single('site_favicon'), uploadSiteFavicon);
router.post('/settings/header-logo', upload.single('header_logo'), uploadHeaderLogo);
router.post('/settings/footer-logo', upload.single('footer_logo'), uploadFooterLogo);

// Banners (admin)
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);
router.patch('/banners/:id/toggle', toggleBanner);

// FAQs (admin)
router.get('/faqs/admin/all', getFAQs);
router.post('/faqs', createFAQ);
router.put('/faqs/:id', updateFAQ);
router.delete('/faqs/:id', deleteFAQ);
router.patch('/faqs/:id/toggle', toggleFAQ);

// Static Pages (admin)
router.get('/pages', getPages);
router.post('/pages', upload.fields([{ name: 'image1', maxCount: 1 }, { name: 'image2', maxCount: 1 }]), createPage);
router.put('/pages/:id', upload.fields([{ name: 'image1', maxCount: 1 }, { name: 'image2', maxCount: 1 }]), updatePage);
router.delete('/pages/:id', deletePage);

// Menus (admin)
router.post('/menus', createMenuItem);
router.put('/menus/:id', updateMenuItem);
router.delete('/menus/:id', deleteMenuItem);
router.patch('/menus/:id/toggle', toggleMenuItem);

// Registration Steps (admin)
router.get('/registration-steps/admin', getRegistrationSteps); // Admin fetches all
router.post('/registration-steps', createRegistrationStep);
router.put('/registration-steps/:id', updateRegistrationStep);
router.delete('/registration-steps/:id', deleteRegistrationStep);
router.patch('/registration-steps/:id/toggle', toggleRegistrationStep);
router.post('/registration-steps/bulk', bulkUpdateRegistrationSteps);
router.post('/registration-steps/reset', resetRegistrationSteps);

// Email Templates (admin)
router.get('/email-templates/admin', getEmailTemplates);
router.put('/email-templates/:id', updateEmailTemplate);

// Testimonials (admin)
router.post('/testimonials', createTestimonial);
router.put('/testimonials/:id', updateTestimonial);
router.delete('/testimonials/:id', deleteTestimonial);
router.patch('/testimonials/:id/toggle', toggleTestimonial);

// Startup Ideas Admin
router.get('/startup/faqs/admin', getStartupFAQs); // Fetch all for admin
router.post('/startup/faqs', createStartupFAQ);
router.put('/startup/faqs/:id', updateStartupFAQ);
router.delete('/startup/faqs/:id', deleteStartupFAQ);
router.patch('/startup/faqs/:id/toggle', toggleStartupFAQ);

router.put('/startup/terms', updateStartupTerms);
router.put('/startup/privacy', updateStartupPrivacy);

module.exports = router;
