const Invitation = require('../models/Invitation');

// @desc    Get invitations for a freelancer
// @route   GET /api/invitations
// @access  Private
exports.getMyInvitations = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const invitations = await Invitation.find({ freelancer_id: userId })
            .populate('client_id', 'full_name profile_image')
            .populate('project_id', 'title budget_range duration')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: invitations.length, data: invitations });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update invitation status (accept/decline)
// @route   PUT /api/invitations/:id
// @access  Private
exports.updateInvitation = async (req, res) => {
    try {
        const { status } = req.body;
        const invitation = await Invitation.findById(req.params.id);

        if (!invitation) {
            return res.status(404).json({ success: false, message: 'Invitation not found' });
        }

        if (invitation.freelancer_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized to perform this operation' });
        }

        invitation.status = status;
        await invitation.save();

        res.json({ success: true, data: invitation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send an invitation (for clients)
// @route   POST /api/invitations
// @access  Private
exports.sendInvitation = async (req, res) => {
    try {
        const { freelancer_id, project_id, message } = req.body;
        
        // Prevent duplicate invites for the same project
        const existingInvite = await Invitation.findOne({
            client_id: req.user.id,
            freelancer_id,
            project_id
        });

        if (existingInvite && project_id) {
            return res.status(400).json({ success: false, message: 'Already sent invitation for this project' });
        }

        const invitation = await Invitation.create({
            client_id: req.user.id,
            freelancer_id,
            project_id: project_id || null,
            message
        });

        res.status(201).json({ success: true, data: invitation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
