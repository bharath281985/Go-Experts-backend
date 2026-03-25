const express = require('express');
const router = express.Router();
const {
    getCategories,
    addCategory,
    updateCategory,
    deleteCategory
} = require('../controller/startupCategoryController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
    .get(getCategories)
    .post(protect, authorize('admin'), addCategory);

router.route('/:id')
    .put(protect, authorize('admin'), updateCategory)
    .delete(protect, authorize('admin'), deleteCategory);

module.exports = router;
