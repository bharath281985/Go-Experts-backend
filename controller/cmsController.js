const Category = require('../models/Category');
const Skill = require('../models/Skill');
const SiteSettings = require('../models/SiteSettings');
const Banner = require('../models/Banner');
const FAQ = require('../models/FAQ');
const StaticPage = require('../models/StaticPage');
const Menu = require('../models/Menu');
const RegistrationStep = require('../models/RegistrationStep');
const EmailTemplate = require('../models/EmailTemplate');
const Testimonial = require('../models/Testimonial');

// ─────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────

// GET all categories (with parent populated)
exports.getCategories = async (req, res) => {
    try {
        const query = req.user?.roles.includes('admin') ? {} : { is_active: true };
        const categories = await Category.find(query).populate('parent', 'name').sort({ sort_order: 1, name: 1 });
        res.status(200).json({ success: true, count: categories.length, data: categories, categories: categories });
    } catch (error) {
        console.error('getCategories:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
};

// GET single category
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).populate('parent', 'name');
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        res.status(200).json({ success: true, category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch category' });
    }
};

// POST create category
exports.createCategory = async (req, res) => {
    try {
        const { name, description, icon, parent, sort_order } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        // Check duplicate name
        const exists = await Category.findOne({ name: name.trim() });
        if (exists) {
            return res.status(400).json({ success: false, message: 'A category with this name already exists' });
        }

        let image = null;
        if (req.file) {
            image = `/uploads/categories/${req.file.filename}`;
        }

        const category = await Category.create({ 
            name: name.trim(), 
            description, 
            icon, 
            image,
            parent: parent || null, 
            sort_order: sort_order || 0 
        });
        res.status(201).json({ success: true, message: 'Category created successfully', category });
    } catch (error) {
        console.error('createCategory:', error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Category name already exists' });
        }
        res.status(500).json({ success: false, message: error.message || 'Failed to create category' });
    }
};

// PUT update category
exports.updateCategory = async (req, res) => {
    try {
        const { name, description, icon, parent, sort_order, is_active } = req.body;
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

        // Check name uniqueness if changing
        if (name && name.trim() !== category.name) {
            const exists = await Category.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
            if (exists) return res.status(400).json({ success: false, message: 'A category with this name already exists' });
        }

        if (name !== undefined) category.name = name.trim();
        if (description !== undefined) category.description = description;
        if (icon !== undefined) category.icon = icon;
        if (parent !== undefined) category.parent = parent || null;
        if (sort_order !== undefined) category.sort_order = sort_order;
        if (is_active !== undefined) category.is_active = Boolean(is_active);

        if (req.file) {
            category.image = `/uploads/categories/${req.file.filename}`;
        }

        await category.save();
        res.status(200).json({ success: true, message: 'Category updated successfully', category });
    } catch (error) {
        console.error('updateCategory:', error);
        res.status(500).json({ success: false, message: 'Failed to update category' });
    }
};

// DELETE category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

        // Check if it has children
        const childCount = await Category.countDocuments({ parent: req.params.id });
        if (childCount > 0) {
            return res.status(400).json({ success: false, message: `Cannot delete: this category has ${childCount} subcategories. Delete or reassign them first.` });
        }

        await Category.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
};

// PATCH toggle category active status
exports.toggleCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        category.is_active = !category.is_active;
        await category.save();
        res.status(200).json({ success: true, message: category.is_active ? 'Category activated' : 'Category deactivated', category });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle category' });
    }
};


// ─────────────────────────────────────────────
//  SKILLS
// ─────────────────────────────────────────────

exports.getSkills = async (req, res) => {
    try {
        const skills = await Skill.find({}).populate('category', 'name').sort({ sort_order: 1, name: 1 });
        res.status(200).json({ success: true, count: skills.length, skills: skills, data: skills });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch skills' });
    }
};

exports.createSkill = async (req, res) => {
    try {
        const { name, category, sort_order } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Skill name is required' });

        const exists = await Skill.findOne({ name: name.trim() });
        if (exists) return res.status(400).json({ success: false, message: 'A skill with this name already exists' });

        const skill = await Skill.create({ name: name.trim(), category: category || null, sort_order: sort_order || 0 });
        await skill.populate('category', 'name');
        res.status(201).json({ success: true, message: 'Skill created successfully', skill });
    } catch (error) {
        console.error('createSkill:', error);
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Skill name or slug already exists' });
        res.status(500).json({ success: false, message: error.message || 'Failed to create skill' });
    }
};

exports.updateSkill = async (req, res) => {
    try {
        const { name, category, sort_order, is_active } = req.body;
        const skill = await Skill.findById(req.params.id);
        if (!skill) return res.status(404).json({ success: false, message: 'Skill not found' });

        if (name && name.trim() !== skill.name) {
            const exists = await Skill.findOne({ name: name.trim(), _id: { $ne: req.params.id } });
            if (exists) return res.status(400).json({ success: false, message: 'Skill name already exists' });
        }

        if (name !== undefined) skill.name = name.trim();
        if (category !== undefined) skill.category = category || null;
        if (sort_order !== undefined) skill.sort_order = sort_order;
        if (is_active !== undefined) skill.is_active = Boolean(is_active);

        await skill.save();
        await skill.populate('category', 'name');
        res.status(200).json({ success: true, message: 'Skill updated successfully', skill });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update skill' });
    }
};

exports.deleteSkill = async (req, res) => {
    try {
        const skill = await Skill.findById(req.params.id);
        if (!skill) return res.status(404).json({ success: false, message: 'Skill not found' });
        await Skill.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Skill deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete skill' });
    }
};

exports.toggleSkill = async (req, res) => {
    try {
        const skill = await Skill.findById(req.params.id);
        if (!skill) return res.status(404).json({ success: false, message: 'Skill not found' });
        skill.is_active = !skill.is_active;
        await skill.save();
        res.status(200).json({ success: true, message: skill.is_active ? 'Skill activated' : 'Skill deactivated', skill });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle skill' });
    }
};


// ─────────────────────────────────────────────
//  SITE SETTINGS  (singleton)
// ─────────────────────────────────────────────

// Public: Fetch site settings (minimal data, no secrets)
exports.getSiteSettings = async (req, res) => {
    try {
        let settings = await SiteSettings.findById('site_settings');
        if (!settings) {
            settings = await SiteSettings.create({ _id: 'site_settings' });
        }

        // Remove sensitive fields for public view
        const publicSettings = settings.toObject();
        delete publicSettings.smtp_host;
        delete publicSettings.smtp_port;
        delete publicSettings.smtp_user;
        delete publicSettings.smtp_pass;
        // Keep email_from and email_from_name as they are branding info (not secrets)

        res.status(200).json({ success: true, settings: publicSettings });
    } catch (error) {
        console.error('getSiteSettings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch site settings' });
    }
};

// Admin: Fetch full site settings including SMTP
exports.getAdminSiteSettings = async (req, res) => {
    try {
        let settings = await SiteSettings.findById('site_settings');
        if (!settings) {
            settings = await SiteSettings.create({ _id: 'site_settings' });
        }
        res.status(200).json({ success: true, settings });
    } catch (error) {
        console.error('getAdminSiteSettings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch site settings' });
    }
};

exports.updateSiteSettings = async (req, res) => {
    try {
        const allowedFields = [
            'site_name', 'site_tagline', 'site_logo', 'site_favicon',
            'contact_email', 'contact_phone', 'contact_address',
            'meta_title', 'meta_description', 'meta_keywords',
            'social_facebook', 'social_twitter', 'social_linkedin', 'social_instagram',
            'commission_rate', 'currency', 'timezone', 'maintenance_mode',
            'points_per_rupee', 'points_signup_bonus',
            'home_stats', 'trust_badges',
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass',
            'email_from', 'email_from_name', 'email_reply_to', 'email_encryption'
        ];

        const updates = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
        }

        const settings = await SiteSettings.findByIdAndUpdate(
            'site_settings',
            { $set: updates },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        res.status(200).json({ success: true, message: 'Site settings updated successfully', settings });
    } catch (error) {
        console.error('updateSiteSettings:', error);
        res.status(500).json({ success: false, message: 'Failed to update site settings' });
    }
};


// ─────────────────────────────────────────────
//  BANNERS
// ─────────────────────────────────────────────

exports.getBanners = async (req, res) => {
    try {
        const { position } = req.query;
        const filter = {};
        if (position) filter.position = position;
        const banners = await Banner.find(filter).sort({ sort_order: 1, createdAt: -1 });
        res.status(200).json({ success: true, count: banners.length, banners });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch banners' });
    }
};

exports.createBanner = async (req, res) => {
    try {
        const { title, subtitle, image_url, link_url, link_text, position, sort_order, start_date, end_date, target_audience } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Banner title is required' });
        }
        const banner = await Banner.create({ title: title.trim(), subtitle, image_url, link_url, link_text, position, sort_order: sort_order || 0, start_date: start_date || null, end_date: end_date || null, target_audience });
        res.status(201).json({ success: true, message: 'Banner created successfully', banner });
    } catch (error) {
        console.error('createBanner:', error);
        res.status(500).json({ success: false, message: 'Failed to create banner' });
    }
};

exports.updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });

        const allowedFields = ['title', 'subtitle', 'image_url', 'link_url', 'link_text', 'position', 'is_active', 'sort_order', 'start_date', 'end_date', 'target_audience'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) banner[field] = req.body[field];
        });

        await banner.save();
        res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update banner' });
    }
};

exports.deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
        await Banner.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete banner' });
    }
};

exports.toggleBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
        banner.is_active = !banner.is_active;
        await banner.save();
        res.status(200).json({ success: true, message: banner.is_active ? 'Banner activated' : 'Banner deactivated', banner });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle banner' });
    }
};

// ─────────────────────────────────────────────
//  FAQs
// ─────────────────────────────────────────────

exports.getFAQs = async (req, res) => {
    try {
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        const faqs = await FAQ.find(filter).sort({ sort_order: 1, createdAt: 1 });
        res.status(200).json({ success: true, count: faqs.length, faqs });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch FAQs' });
    }
};

exports.createFAQ = async (req, res) => {
    try {
        const { question, answer, category, sort_order } = req.body;
        if (!question || !question.trim()) return res.status(400).json({ success: false, message: 'Question is required' });
        if (!answer || !answer.trim()) return res.status(400).json({ success: false, message: 'Answer is required' });
        const faq = await FAQ.create({ question: question.trim(), answer: answer.trim(), category: category || 'General', sort_order: sort_order || 0 });
        res.status(201).json({ success: true, message: 'FAQ created successfully', faq });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create FAQ' });
    }
};

exports.updateFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        const { question, answer, category, sort_order, is_active } = req.body;
        if (question !== undefined) faq.question = question.trim();
        if (answer !== undefined) faq.answer = answer.trim();
        if (category !== undefined) faq.category = category;
        if (sort_order !== undefined) faq.sort_order = sort_order;
        if (is_active !== undefined) faq.is_active = Boolean(is_active);
        await faq.save();
        res.status(200).json({ success: true, message: 'FAQ updated successfully', faq });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update FAQ' });
    }
};

exports.deleteFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        await FAQ.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'FAQ deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete FAQ' });
    }
};

exports.toggleFAQ = async (req, res) => {
    try {
        const faq = await FAQ.findById(req.params.id);
        if (!faq) return res.status(404).json({ success: false, message: 'FAQ not found' });
        faq.is_active = !faq.is_active;
        await faq.save();
        res.status(200).json({ success: true, faq });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle FAQ' });
    }
};

// ─────────────────────────────────────────────
//  STATIC PAGES
// ─────────────────────────────────────────────

exports.getPages = async (req, res) => {
    try {
        const pages = await StaticPage.find({}).sort({ updatedAt: -1 });
        res.status(200).json({ success: true, count: pages.length, pages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch pages' });
    }
};

exports.getPageBySlug = async (req, res) => {
    try {
        const slug = req.params.slug?.toLowerCase().trim();
        const page = await StaticPage.findOne({ 
            slug, 
            status: 'published' 
        });
        if (!page) return res.status(404).json({ success: false, message: 'Page not found or is in draft' });
        res.status(200).json({ success: true, page });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch page' });
    }
};

exports.createPage = async (req, res) => {
    try {
        const { 
            title, slug, content, meta_title, meta_description, status,
            vision, vision_icon, mission, mission_icon, mission_points, responsibilities,
            differentiators 
        } = req.body;
        
        if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
        if (!slug || !slug.trim()) return res.status(400).json({ success: false, message: 'Slug is required' });
        
        const exists = await StaticPage.findOne({ slug: slug.trim().toLowerCase() });
        if (exists) return res.status(400).json({ success: false, message: 'A page with this slug already exists' });
        
        const pageData = { 
            title: title.trim(), slug: slug.trim().toLowerCase(), 
            content: content || '', meta_title, meta_description, 
            status: status || 'published',
            vision, vision_icon, mission, mission_icon, responsibilities,
            mission_points: typeof mission_points === 'string' ? JSON.parse(mission_points) : mission_points,
            differentiators: typeof differentiators === 'string' ? JSON.parse(differentiators) : differentiators
        };

        // Handle file uploads
        if (req.files) {
            if (req.files.image1) {
                pageData.image1 = `/uploads/pages/${req.files.image1[0].filename}`;
            }
            if (req.files.image2) {
                pageData.image2 = `/uploads/pages/${req.files.image2[0].filename}`;
            }
        }

        const page = await StaticPage.create(pageData);
        res.status(201).json({ success: true, message: 'Page created successfully', page });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Page slug already exists' });
        res.status(500).json({ success: false, message: 'Failed to create page' });
    }
};

exports.updatePage = async (req, res) => {
    try {
        const page = await StaticPage.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
        
        const { 
            title, slug, content, meta_title, meta_description, status,
            vision, vision_icon, mission, mission_icon, mission_points, responsibilities,
            differentiators 
        } = req.body;

        if (title !== undefined) page.title = title.trim();
        if (slug !== undefined) page.slug = slug.trim().toLowerCase();
        if (content !== undefined) page.content = content;
        if (meta_title !== undefined) page.meta_title = meta_title;
        if (meta_description !== undefined) page.meta_description = meta_description;
        if (status !== undefined) page.status = status;

        // Structured content
        if (vision !== undefined) page.vision = vision;
        if (vision_icon !== undefined) page.vision_icon = vision_icon;
        if (mission !== undefined) page.mission = mission;
        if (mission_icon !== undefined) page.mission_icon = mission_icon;
        if (responsibilities !== undefined) page.responsibilities = responsibilities;
        
        if (mission_points !== undefined) {
            try {
                page.mission_points = typeof mission_points === 'string' ? JSON.parse(mission_points) : mission_points;
            } catch (e) {
                console.error('Failed to parse mission_points:', e);
            }
        }

        if (differentiators !== undefined) {
            try {
                // Handle both stringified JSON and direct array
                page.differentiators = typeof differentiators === 'string' ? JSON.parse(differentiators) : differentiators;
            } catch (e) {
                console.error('Failed to parse differentiators:', e);
            }
        }

        // Handle file uploads
        if (req.files) {
            if (req.files.image1) {
                page.image1 = `/uploads/pages/${req.files.image1[0].filename}`;
            }
            if (req.files.image2) {
                page.image2 = `/uploads/pages/${req.files.image2[0].filename}`;
            }
        }

        await page.save();
        res.status(200).json({ success: true, message: 'Page updated successfully', page });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update page' });
    }
};

exports.deletePage = async (req, res) => {
    try {
        const page = await StaticPage.findById(req.params.id);
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
        await StaticPage.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Page deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete page' });
    }
};

// ─────────────────────────────────────────────
//  MENUS
// ─────────────────────────────────────────────

exports.getMenus = async (req, res) => {
    try {
        const { location } = req.query;
        const filter = {};
        if (location) filter.location = location;
        const menus = await Menu.find(filter).populate('parent', 'label url').sort({ order: 1 });
        res.status(200).json({ success: true, count: menus.length, menus });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch menus' });
    }
};

exports.createMenuItem = async (req, res) => {
    try {
        const { label, url, location, parent, order, open_in_new_tab } = req.body;
        if (!label || !label.trim()) return res.status(400).json({ success: false, message: 'Label is required' });
        if (!url || !url.trim()) return res.status(400).json({ success: false, message: 'URL is required' });
        const item = await Menu.create({ label: label.trim(), url: url.trim(), location: location || 'header', parent: parent || null, order: order || 0, open_in_new_tab: Boolean(open_in_new_tab) });
        res.status(201).json({ success: true, message: 'Menu item created', item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create menu item' });
    }
};

exports.updateMenuItem = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
        const { label, url, location, parent, order, is_active, open_in_new_tab } = req.body;
        if (label !== undefined) item.label = label.trim();
        if (url !== undefined) item.url = url.trim();
        if (location !== undefined) item.location = location;
        if (parent !== undefined) item.parent = parent || null;
        if (order !== undefined) item.order = order;
        if (is_active !== undefined) item.is_active = Boolean(is_active);
        if (open_in_new_tab !== undefined) item.open_in_new_tab = Boolean(open_in_new_tab);
        await item.save();
        res.status(200).json({ success: true, message: 'Menu item updated', item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update menu item' });
    }
};

exports.deleteMenuItem = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
        // Delete children too
        await Menu.deleteMany({ parent: req.params.id });
        await Menu.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Menu item deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete menu item' });
    }
};

exports.toggleMenuItem = async (req, res) => {
    try {
        const item = await Menu.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Menu item not found' });
        item.is_active = !item.is_active;
        await item.save();
        res.status(200).json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle menu item' });
    }
};

// ─────────────────────────────────────────────
//  REGISTRATION STEPS
// ─────────────────────────────────────────────

exports.getRegistrationSteps = async (req, res) => {
    try {
        const query = req.user?.roles.includes('admin') ? {} : { isActive: true };
        const steps = await RegistrationStep.find(query).sort({ order: 1 });
        res.status(200).json({ success: true, count: steps.length, data: steps });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch registration steps' });
    }
};

exports.createRegistrationStep = async (req, res) => {
    try {
        const step = await RegistrationStep.create(req.body);
        res.status(201).json({ success: true, message: 'Step created successfully', data: step });
    } catch (error) {
        console.error('createRegistrationStep:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to create step' });
    }
};

exports.updateRegistrationStep = async (req, res) => {
    try {
        const step = await RegistrationStep.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!step) return res.status(404).json({ success: false, message: 'Step not found' });
        res.status(200).json({ success: true, message: 'Step updated successfully', data: step });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update step' });
    }
};

exports.deleteRegistrationStep = async (req, res) => {
    try {
        const step = await RegistrationStep.findById(req.params.id);
        if (!step) return res.status(404).json({ success: false, message: 'Step not found' });
        await RegistrationStep.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Step deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete step' });
    }
};

exports.toggleRegistrationStep = async (req, res) => {
    try {
        const step = await RegistrationStep.findById(req.params.id);
        if (!step) return res.status(404).json({ success: false, message: 'Step not found' });
        step.isActive = !step.isActive;
        await step.save();
        res.status(200).json({ success: true, message: step.isActive ? 'Step activated' : 'Step deactivated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle step' });
    }
};

// Bulk update registration steps
exports.bulkUpdateRegistrationSteps = async (req, res) => {
    try {
        const { steps } = req.body;
        if (!Array.isArray(steps)) {
            return res.status(400).json({ success: false, message: 'Steps must be an array' });
        }
        await RegistrationStep.deleteMany({});
        const newSteps = await RegistrationStep.insertMany(steps);
        res.status(200).json({ success: true, message: 'Steps updated in bulk', data: newSteps });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reset registration steps to default dummy data
exports.resetRegistrationSteps = async (req, res) => {
    try {
        const seedSteps = [
            {
                order: 1, label: 'Account Type', title: 'How do you want to use Go Experts?', description: 'Choose your primary role',
                type: 'single-selection', field: 'accountType',
                options: [
                    { value: 'client', label: 'Hire Talent', emoji: '🎯', description: 'I want to hire freelancers for my projects' },
                    { value: 'freelancer', label: 'Work as Freelancer', emoji: '💼', description: 'I want to offer my services and find work' },
                    { value: 'both', label: 'Both', emoji: '🔁', description: 'I want to hire and work as a freelancer' }
                ]
            },
            {
                order: 2, label: 'Categories', title: 'What services are you interested in?', description: 'Select all that apply',
                type: 'multi-selection', field: 'categories',
                options: [
                    { value: 'uiux', label: 'UI/UX Design', icon: 'Palette' },
                    { value: 'webdev', label: 'Web Development', icon: 'Code' },
                    { value: 'mobiledev', label: 'Mobile Apps', icon: 'Smartphone' },
                    { value: 'marketing', label: 'Digital Marketing', icon: 'TrendingUp' },
                    { value: 'writing', label: 'Content Writing', icon: 'FileText' },
                    { value: 'video', label: 'Video Editing', icon: 'Video' },
                    { value: 'security', label: 'Cybersecurity', icon: 'Shield' },
                    { value: 'consulting', label: 'Business Consulting', icon: 'Building' }
                ]
            },
            {
                order: 3, label: 'Work Style', title: 'How do you prefer to work?', description: 'Choose your work style',
                type: 'single-selection', field: 'workPreference',
                options: [
                    { value: 'remote', label: 'Remote', icon: 'Globe' },
                    { value: 'onsite', label: 'Onsite', icon: 'MapPin' },
                    { value: 'hybrid', label: 'Hybrid', icon: 'MapPin' }
                ]
            },
            {
                order: 4, label: 'Budget', title: "What's your budget or rate range?", description: 'Select the range that fits best',
                type: 'single-selection', field: 'budgetRange',
                options: [
                    { value: '5k-15k', label: '₹5K - ₹15K', subtitle: 'Starter' },
                    { value: '15k-50k', label: '₹15K - ₹50K', subtitle: 'Standard' },
                    { value: '50k-1l', label: '₹50K - ₹1L', subtitle: 'Premium' },
                    { value: '1l+', label: '₹1L+', subtitle: 'Enterprise' }
                ]
            },
            {
                order: 5, label: 'Experience', title: 'Choose your experience level', description: 'This helps us match you better',
                type: 'single-selection', field: 'experienceLevel',
                options: [
                    { value: 'beginner', label: 'Beginner', emoji: '🌱' },
                    { value: 'intermediate', label: 'Intermediate', emoji: '⚡' },
                    { value: 'expert', label: 'Expert', emoji: '🏆' }
                ]
            },
            {
                order: 6, label: 'Location', title: 'Where are you based?', description: 'Optional - helps with local opportunities',
                type: 'input', field: 'location'
            },
            {
                order: 7, label: 'Availability', title: 'What is your availability?', description: 'Choose when you can start',
                type: 'single-selection', field: 'availability',
                options: [
                    { value: 'fulltime', label: 'Full-time' },
                    { value: 'parttime', label: 'Part-time' },
                    { value: 'weekends', label: 'Weekends' }
                ]
            },
            {
                order: 8, label: 'Create Account', title: 'Final Step: Create your account', description: 'Enter your details to complete registration',
                type: 'account-creation', field: 'account'
            }
        ];
        await RegistrationStep.deleteMany({});
        const steps = await RegistrationStep.insertMany(seedSteps);

        // Also seed categories if empty
        const Category = require('../models/Category');
        const categoryCount = await Category.countDocuments();
        if (categoryCount === 0) {
            const mockCategories = [
                { name: 'Web Development', icon: '🌐', is_active: true, sort_order: 1 },
                { name: 'Mobile Apps', icon: '📱', is_active: true, sort_order: 2 },
                { name: 'UI/UX Design', icon: '🎨', is_active: true, sort_order: 3 },
                { name: 'Digital Marketing', icon: '📈', is_active: true, sort_order: 4 },
                { name: 'Content Writing', icon: '✍️', is_active: true, sort_order: 5 },
                { name: 'Data Science', icon: '📊', is_active: true, sort_order: 6 }
            ];
            await Category.create(mockCategories);
        }

        // Also seed Admin if empty
        const User = require('../models/User');
        const adminExists = await User.findOne({ email: 'doorstephub@gmail.com' });
        if (!adminExists) {
            await User.create({
                full_name: 'Admin User',
                email: 'doorstephub@gmail.com',
                password: 'password123',
                roles: ['admin', 'client', 'freelancer'],
                is_email_verified: true
            });
        }

        res.status(200).json({ success: true, message: 'Steps and categories reset to default dummy data', data: steps });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reset steps' });
    }
};

// ─────────────────────────────────────────────
//  EMAIL TEMPLATES
// ─────────────────────────────────────────────

exports.getEmailTemplates = async (req, res) => {
    try {
        let templates = await EmailTemplate.find().sort({ createdAt: -1 });
        if (templates.length === 0) {
            templates = await EmailTemplate.insertMany([
                { name: 'Welcome Email', subject: 'Welcome to Go Experts!', body: 'Hello {name},<br><br>Welcome to Go Experts! We are glad to have you.<br><br>Thanks,<br>Team Go Experts', trigger: 'welcome' },
                { name: 'Email Verification', subject: 'Verify your email address', body: 'Hello {name},<br><br>Please verify your email address by clicking the link below:<br><a href="{link}">Verify Email</a><br><br>Thanks,<br>Team Go Experts', trigger: 'email_verification' },
                { name: 'Password Reset', subject: 'Reset your password', body: 'Hello {name},<br><br>You requested a password reset. Click the link below to reset it:<br><a href="{link}">Reset Password</a><br><br>Thanks,<br>Team Go Experts', trigger: 'password_reset' }
            ]);
        }
        res.status(200).json({ success: true, count: templates.length, templates });
    } catch (error) {
        console.error('getEmailTemplates error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch email templates' });
    }
};

exports.updateEmailTemplate = async (req, res) => {
    try {
        const { subject, body, status } = req.body;
        const template = await EmailTemplate.findById(req.params.id);
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

        if (subject !== undefined) template.subject = subject;
        if (body !== undefined) template.body = body;
        if (status !== undefined) template.status = status;

        await template.save();
        res.status(200).json({ success: true, message: 'Template updated successfully', template });
    } catch (error) {
        console.error('updateEmailTemplate error:', error);
        res.status(500).json({ success: false, message: 'Failed to update template' });
    }
};

// ─────────────────────────────────────────────
//  TESTIMONIALS
// ─────────────────────────────────────────────

exports.getTestimonials = async (req, res) => {
    try {
        const query = req.user?.roles.includes('admin') ? {} : { is_active: true };
        const testimonials = await Testimonial.find(query).sort({ sort_order: 1, createdAt: -1 });
        res.status(200).json({ success: true, count: testimonials.length, testimonials });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
    }
};

exports.createTestimonial = async (req, res) => {
    try {
        const { name, role, rating, text, avatar, sort_order } = req.body;
        if (!name || !text) return res.status(400).json({ success: false, message: 'Name and text are required' });
        const testimonial = await Testimonial.create({ name, role, rating, text, avatar, sort_order: sort_order || 0 });
        res.status(201).json({ success: true, message: 'Testimonial created successfully', testimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create testimonial' });
    }
};

exports.updateTestimonial = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found' });
        const fields = ['name', 'role', 'rating', 'text', 'avatar', 'sort_order', 'is_active'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) testimonial[f] = req.body[f];
        });
        await testimonial.save();
        res.status(200).json({ success: true, message: 'Testimonial updated successfully', testimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update testimonial' });
    }
};

exports.deleteTestimonial = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found' });
        await Testimonial.deleteOne({ _id: req.params.id });
        res.status(200).json({ success: true, message: 'Testimonial deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
    }
};

exports.toggleTestimonial = async (req, res) => {
    try {
        const testimonial = await Testimonial.findById(req.params.id);
        if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found' });
        testimonial.is_active = !testimonial.is_active;
        await testimonial.save();
        res.status(200).json({ success: true, message: testimonial.is_active ? 'Testimonial activated' : 'Testimonial deactivated', testimonial });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to toggle testimonial' });
    }
};
