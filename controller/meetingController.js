const Meeting = require('../models/Meeting');
const StartupIdea = require('../models/StartupIdea');
const User = require('../models/User');

// @desc    Schedule a meeting
// @route   POST /api/meetings
// @access  Private
exports.scheduleMeeting = async (req, res) => {
    try {
        const {
            creator_id, // Founder/startup creator
            idea_id,
            meeting_date,
            mode,
            agenda
        } = req.body;

        const meeting = await Meeting.create({
            investor: req.user._id,
            founder: creator_id,
            startup_idea: idea_id,
            meeting_date,
            mode,
            agenda,
            status: 'scheduled',
            created_by: req.user._id
        });

        res.status(201).json({ success: true, data: meeting });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get meetings list (Investor or Founder)
// @route   GET /api/meetings
// @access  Private
exports.getMeetings = async (req, res) => {
    try {
        let query = { $or: [{ investor: req.user._id }, { founder: req.user._id }] };
        const meetings = await Meeting.find(query)
            .populate('investor', 'full_name profile_image email')
            .populate('founder', 'full_name profile_image email')
            .populate('startup_idea', 'title category')
            .sort({ meeting_date: 1 });

        res.json({ success: true, count: meetings.length, data: meetings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Update meeting status
// @route   PATCH /api/meetings/:id
// @access  Private
exports.updateMeeting = async (req, res) => {
    try {
        const { status, meeting_link, notes, meeting_date } = req.body;
        
        let meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ success: false, message: 'Meeting not found' });
        }

        if (meeting.investor.toString() !== req.user._id.toString() && meeting.founder.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        meeting.status = status || meeting.status;
        meeting.meeting_link = meeting_link || meeting.meeting_link;
        meeting.notes = notes || meeting.notes;
        meeting.meeting_date = meeting_date || meeting.meeting_date;

        await meeting.save();

        res.json({ success: true, data: meeting });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
