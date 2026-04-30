const User = require('../../../models/User');

/**
 * @desc    Get user portfolio
 * @route   GET /api/mobile/user/portfolio
 * @access  Private
 */
exports.getPortfolio = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('portfolio');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({
            success: true,
            data: user.portfolio || []
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Add portfolio item
 * @route   POST /api/mobile/user/portfolio
 * @access  Private
 */
exports.addPortfolioItem = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { title, description, links, duration_days, completion_date } = req.body;

        // Handle links as an array (supports multiple form fields or a JSON string)
        let parsedLinks = links;
        if (typeof parsedLinks === 'string') {
            try {
                parsedLinks = JSON.parse(parsedLinks);
            } catch (e) {
                // If it's a comma-separated string, split it, otherwise keep as is
                parsedLinks = parsedLinks.includes(',') ? parsedLinks.split(',').map(l => l.trim()) : [parsedLinks];
            }
        }

        const newItem = {
            title,
            description,
            links: Array.isArray(parsedLinks) ? parsedLinks : (parsedLinks ? [parsedLinks] : []),
            duration_days: duration_days || 0,
            completion_date: completion_date || Date.now(),
            images: []
        };

        if (req.files && req.files.portfolio_image) {
            newItem.image = `/uploads/portfolio/${req.files.portfolio_image[0].filename}`;
            newItem.images = req.files.portfolio_image.map(file => `/uploads/portfolio/${file.filename}`);
        }

        user.portfolio.push(newItem);
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Portfolio item added successfully',
            data: user.portfolio[user.portfolio.length - 1]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update portfolio item
 * @route   PUT /api/mobile/user/portfolio/:id
 * @access  Private
 */
exports.updatePortfolioItem = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const item = user.portfolio.id(req.params.id);
        if (!item) return res.status(404).json({ success: false, message: 'Portfolio item not found' });

        const { title, description, links, duration_days, completion_date } = req.body;

        if (title) item.title = title;
        if (description) item.description = description;
        if (links) {
            let parsedLinks = links;
            if (typeof parsedLinks === 'string') {
                try {
                    parsedLinks = JSON.parse(parsedLinks);
                } catch (e) {
                    parsedLinks = parsedLinks.includes(',') ? parsedLinks.split(',').map(l => l.trim()) : [parsedLinks];
                }
            }
            item.links = Array.isArray(parsedLinks) ? parsedLinks : [parsedLinks];
        }
        if (duration_days) item.duration_days = duration_days;
        if (completion_date) item.completion_date = completion_date;

        if (req.files && req.files.portfolio_image) {
            item.image = `/uploads/portfolio/${req.files.portfolio_image[0].filename}`;
            item.images = req.files.portfolio_image.map(file => `/uploads/portfolio/${file.filename}`);
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Portfolio item updated successfully',
            data: item
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete portfolio item
 * @route   DELETE /api/mobile/user/portfolio/:id
 * @access  Private
 */
exports.deletePortfolioItem = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.portfolio.pull({ _id: req.params.id });
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Portfolio item deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Full Portfolio (Bulk)
 * @route   PUT /api/mobile/user/portfolio
 * @access  Private
 */
exports.updateFullPortfolio = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { portfolio } = req.body;

        if (portfolio) {
            let parsedPortfolio = typeof portfolio === 'string' ? JSON.parse(portfolio) : portfolio;
            if (Array.isArray(parsedPortfolio)) {
                user.portfolio = parsedPortfolio;
            } else {
                return res.status(400).json({ success: false, message: 'Portfolio must be an array' });
            }
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Full portfolio updated successfully!',
            data: user.portfolio
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
