const StartupIdea = require('../models/StartupIdea');
const InvestorOpportunity = require('../models/InvestorOpportunity');
const Meeting = require('../models/Meeting');
const StartupDocument = require('../models/StartupDocument');
const NDA = require('../models/NDA');
const Message = require('../models/Message');


// @desc    Get investor dashboard overview stats
// @route   GET /api/investor/dashboard/stats
// @access  Private (Investor)
exports.getStats = async (req, res) => {
    try {
        const savedIdeasCount = await InvestorOpportunity.countDocuments({ investor: req.user._id, status: 'saved' });
        const activeDealsCount = await InvestorOpportunity.countDocuments({ investor: req.user._id, status: 'interested' });
        const meetingsCount = await Meeting.countDocuments({ investor: req.user._id, status: 'scheduled' });
        
        const unreadMessagesCount = await Message.countDocuments({ receiver: req.user._id, isRead: false });

        res.json({
            success: true,
            data: {
                savedIdeas: savedIdeasCount,
                activeDeals: activeDealsCount,
                meetings: meetingsCount,
                unreadMessages: unreadMessagesCount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get deal pipeline
// @route   GET /api/investor/dashboard/pipeline
// @access  Private (Investor)
exports.getPipeline = async (req, res) => {
    try {
        const { status } = req.query;
        let query = { investor: req.user._id };
        if (status) query.status = status;

        const opportunities = await InvestorOpportunity.find(query)
            .populate({
                path: 'startup_idea',
                select: 'title category status fundingAmount creator',
                populate: { path: 'creator', select: 'full_name' }
            })
            .sort({ updatedAt: -1 });

        res.json({ success: true, count: opportunities.length, data: opportunities });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Update opportunity status (Shortlist, Interested, Archive)
// @route   PATCH /api/investor/dashboard/pipeline/:id
// @access  Private (Investor)
exports.updateOpportunity = async (req, res) => {
    try {
        const { status, next_step, priority, notes, score } = req.body;
        
        let opportunity = await InvestorOpportunity.findById(req.params.id);
        if (!opportunity) {
            return res.status(404).json({ success: false, message: 'Opportunity not found' });
        }

        if (opportunity.investor.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        opportunity.status = status || opportunity.status;
        opportunity.next_step = next_step || opportunity.next_step;
        opportunity.priority = priority || opportunity.priority;
        opportunity.notes = notes || opportunity.notes;
        opportunity.score = score || opportunity.score;

        await opportunity.save();

        res.json({ success: true, data: opportunity });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Save/Track an idea
// @route   POST /api/investor/dashboard/track/:ideaId
// @access  Private (Investor)
exports.trackIdea = async (req, res) => {
    try {
        const { status = 'saved' } = req.body;
        
        const opportunity = await InvestorOpportunity.findOneAndUpdate(
            { investor: req.user._id, startup_idea: req.params.ideaId },
            { status, last_viewed: Date.now() },
            { upsert: true, new: true }
        );

        res.json({ success: true, data: opportunity });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
