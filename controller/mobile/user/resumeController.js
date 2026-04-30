const User = require('../../../models/User');

/**
 * @desc    Get User Experience and Education Details
 * @route   GET /api/mobile/user/resume
 * @access  Private
 */
exports.getResumeDetails = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('experience_details education_details');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please log in again.' });
        }

        res.status(200).json({
            success: true,
            message: 'Resume details fetched successfully.',
            data: {
                experience_details: user.experience_details || [],
                education_details: user.education_details || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update User Experience Details
 * @route   PUT /api/mobile/user/experience
 * @access  Private
 */
exports.updateExperience = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please log in again.' });
        }

        if (req.body.experience_details) {
            let parsedExperience = req.body.experience_details;
            if (typeof parsedExperience === 'string') {
                try {
                    parsedExperience = JSON.parse(parsedExperience);
                } catch (err) {
                    return res.status(400).json({ success: false, message: 'Invalid format for experience details. Expected an array.' });
                }
            }

            if (Array.isArray(parsedExperience)) {
                user.experience_details = parsedExperience.map(exp => {
                    if (!exp.year_range && exp.start_month && exp.start_year) {
                        const start = `${exp.start_month} ${exp.start_year}`;
                        const end = exp.is_present ? 'Present' : (exp.end_month && exp.end_year ? `${exp.end_month} ${exp.end_year}` : '');
                        exp.year_range = end ? `${start} - ${end}` : start;
                    }
                    return exp;
                });
            } else {
                return res.status(400).json({ success: false, message: 'Experience details must be an array of objects.' });
            }
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Your professional experience has been updated successfully!',
            data: user.experience_details
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update User Education Details
 * @route   PUT /api/mobile/user/education
 * @access  Private
 */
exports.updateEducation = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please log in again.' });
        }

        if (req.body.education_details) {
            let parsedEducation = req.body.education_details;
            if (typeof parsedEducation === 'string') {
                try {
                    parsedEducation = JSON.parse(parsedEducation);
                } catch (err) {
                    return res.status(400).json({ success: false, message: 'Invalid format for education details. Expected an array.' });
                }
            }

            if (Array.isArray(parsedEducation)) {
                user.education_details = parsedEducation.map(edu => {
                    if (!edu.year_range && edu.start_month && edu.start_year) {
                        const start = `${edu.start_month} ${edu.start_year}`;
                        const end = edu.is_present ? 'Present' : (edu.end_month && edu.end_year ? `${edu.end_month} ${edu.end_year}` : '');
                        edu.year_range = end ? `${start} - ${end}` : start;
                    }
                    return edu;
                });
            } else {
                return res.status(400).json({ success: false, message: 'Education details must be an array of objects.' });
            }
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Your academic background has been updated successfully!',
            data: user.education_details
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Both Experience and Education (Combined)
 * @route   PUT /api/mobile/user/resume
 * @access  Private
 */
exports.updateResume = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const { experience_details, education_details } = req.body;

        // Process Experience
        if (experience_details) {
            let parsedExp = typeof experience_details === 'string' ? JSON.parse(experience_details) : experience_details;
            if (Array.isArray(parsedExp)) {
                user.experience_details = parsedExp.map(exp => {
                    if (!exp.year_range && exp.start_month && exp.start_year) {
                        const start = `${exp.start_month} ${exp.start_year}`;
                        const end = exp.is_present ? 'Present' : (exp.end_month && exp.end_year ? `${exp.end_month} ${exp.end_year}` : '');
                        exp.year_range = end ? `${start} - ${end}` : start;
                    }
                    return exp;
                });
            }
        }

        // Process Education
        if (education_details) {
            let parsedEdu = typeof education_details === 'string' ? JSON.parse(education_details) : education_details;
            if (Array.isArray(parsedEdu)) {
                user.education_details = parsedEdu.map(edu => {
                    if (!edu.year_range && edu.start_month && edu.start_year) {
                        const start = `${edu.start_month} ${edu.start_year}`;
                        const end = edu.is_present ? 'Present' : (edu.end_month && edu.end_year ? `${edu.end_month} ${edu.end_year}` : '');
                        edu.year_range = end ? `${start} - ${end}` : start;
                    }
                    return edu;
                });
            }
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Resume updated successfully!',
            data: {
                experience_details: user.experience_details,
                education_details: user.education_details
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Specific Experience Item
 * @route   DELETE /api/mobile/user/experience/:id
 * @access  Private
 */
exports.deleteExperience = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.experience_details.pull({ _id: req.params.id });
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Experience item deleted successfully',
            data: user.experience_details
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Specific Education Item
 * @route   DELETE /api/mobile/user/education/:id
 * @access  Private
 */
exports.deleteEducation = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.education_details.pull({ _id: req.params.id });
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Education item deleted successfully',
            data: user.education_details
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
