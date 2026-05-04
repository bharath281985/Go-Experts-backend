const express = require('express');
const router = express.Router();
const projectController = require('../../../controller/mobile/user/projectController');

router.route('/my-projects')
    .get(projectController.getMyProjects)
    .post(projectController.getMyProjects);
router.get('/my-projects/:id', projectController.getMyProjectById);

module.exports = router;
