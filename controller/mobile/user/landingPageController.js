const User = require('../../../models/User');

/**
 * @desc    Get landing page and social links
 * @route   GET /api/mobile/user/landing-page
 * @access  Private
 */
exports.getLandingPage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('social_links landing_page_image meta_title meta_keywords meta_description slug');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            data: {
                landing_page_image: user.landing_page_image || '',
                social_links: user.social_links || {},
                seo: {
                    meta_title: user.meta_title || '',
                    meta_keywords: user.meta_keywords || '',
                    meta_description: user.meta_description || '',
                    slug: user.slug || ''
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update landing page and social links
 * @route   PUT /api/mobile/user/landing-page
 * @access  Private
 */
exports.updateLandingPage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (req.body.social_links) {
            let parsedSocialLinks = req.body.social_links;
            if (typeof parsedSocialLinks === 'string') {
                try {
                    parsedSocialLinks = JSON.parse(parsedSocialLinks);
                } catch (e) {}
            }
            if (typeof parsedSocialLinks === 'object') {
                user.social_links = {
                    ...user.social_links?.toObject?.() || user.social_links || {},
                    ...parsedSocialLinks
                };
            }
        }

        const socialPlatforms = ['facebook', 'twitter', 'linkedin', 'instagram', 'github', 'behance', 'dribbble', 'youtube'];
        socialPlatforms.forEach(platform => {
            if (req.body[platform] !== undefined) {
                if (!user.social_links) user.social_links = {};
                user.social_links[platform] = req.body[platform];
            }
        });

        if (req.body.meta_title !== undefined) user.meta_title = req.body.meta_title;
        if (req.body.meta_keywords !== undefined) user.meta_keywords = req.body.meta_keywords;
        if (req.body.meta_description !== undefined) user.meta_description = req.body.meta_description;
        if (req.body.slug !== undefined) {
            const existingUser = await User.findOne({ slug: req.body.slug, _id: { $ne: user._id } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Slug already taken. Please try another one.' });
            }
            user.slug = req.body.slug;
        }

        if (req.file) {
            user.landing_page_image = `/uploads/profiles/${req.file.filename}`;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Landing page details updated successfully',
            data: {
                landing_page_image: user.landing_page_image || '',
                social_links: user.social_links || {},
                seo: {
                    meta_title: user.meta_title || '',
                    meta_keywords: user.meta_keywords || '',
                    meta_description: user.meta_description || '',
                    slug: user.slug || ''
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
