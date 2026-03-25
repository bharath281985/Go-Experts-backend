const StartupCategory = require('../models/StartupCategory');

// @desc    Get all startup categories
// @route   GET /api/startup-categories
// @access  Public
exports.getCategories = async (req, res) => {
    try {
        const categories = await StartupCategory.find({ status: 'active' });
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Add a new startup category
// @route   POST /api/startup-categories
// @access  Private/Admin
exports.addCategory = async (req, res) => {
    try {
        const category = await StartupCategory.create(req.body);
        res.status(201).json({ success: true, data: category });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Update a startup category
// @route   PUT /api/startup-categories/:id
// @access  Private/Admin
exports.updateCategory = async (req, res) => {
    try {
        const category = await StartupCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: category });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Delete a category
// @route   DELETE /api/startup-categories/:id
// @access  Private/Admin
exports.deleteCategory = async (req, res) => {
    try {
        await StartupCategory.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Category deleted' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
