const express = require('express');
const router = express.Router();
const portfolioController = require('../../../controller/mobile/user/portfolioController');
const upload = require('../../../middleware/upload');

router.get('/portfolio', portfolioController.getPortfolio);
router.put('/portfolio', portfolioController.updateFullPortfolio);
router.post('/portfolio', upload.fields([{ name: 'portfolio_image', maxCount: 5 }]), portfolioController.addPortfolioItem);
router.put('/portfolio/:id', upload.fields([{ name: 'portfolio_image', maxCount: 5 }]), portfolioController.updatePortfolioItem);
router.delete('/portfolio/:id', portfolioController.deletePortfolioItem);

module.exports = router;
