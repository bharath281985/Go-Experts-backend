const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Post a gig (Investment Idea)
// @route   POST /api/gigs
// @access  Private/Freelancer
exports.createGig = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.kyc_details?.is_verified) {
             return res.status(403).json({
                success: false,
                message: 'KYC awareness check failed. Please verify your profile to create gigs.'
            });
        }
        req.body.freelancer_id = req.user.id;
        req.body.status = 'live'; 
        const file = Array.isArray(req.files) ? req.files.find(f => f.fieldname === 'thumbnail' || f.fieldname === 'gig_image') || req.files[0] : null;
        if (file) {
            req.body.thumbnail = `/uploads/gigs/${file.filename}`;
        }

        const gig = await Gig.create(req.body);
        res.status(201).json({ success: true, data: gig });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGigs = async (req, res) => {
    try {
        // Fetch all live gigs and populate freelancer info
        const gigs = await Gig.find({ status: 'live' })
            .populate({
                path: 'freelancer_id',
                select: 'full_name profile_image is_suspended kyc_status',
                match: { 
                    is_suspended: { $ne: true },
                    kyc_status: { $ne: 'rejected' }
                }
            });
            
        // Filter out gigs where the freelancer doesn't meet the active criteria (populate returns null for freelancer_id if match fails)
        const activeGigs = gigs.filter(gig => gig.freelancer_id !== null);
        
        res.json({ success: true, count: activeGigs.length, data: activeGigs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get single gig details
// @route   GET /api/gigs/:id
// @access  Public
exports.getGigById = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const gigId = new mongoose.Types.ObjectId(req.params.id);
        
        const gigData = await Gig.aggregate([
            { $match: { _id: gigId } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'freelancer_id',
                    foreignField: '_id',
                    as: 'freelancer'
                }
            },
            { $unwind: { path: '$freelancer', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'gigorders',
                    localField: '_id',
                    foreignField: 'gig_id',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    orders_count: { $size: '$orders' },
                    revenue: {
                        $reduce: {
                            input: '$orders',
                            initialValue: 0,
                            in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.payment_status', 'paid'] }, '$$this.price', 0] }] }
                        }
                    },
                    rating: 4.8,
                    freelancer_id: '$freelancer' // Map back for frontend compatibility
                }
            },
            { $project: { orders: 0, freelancer: 0 } }
        ]);

        if (!gigData || gigData.length === 0) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        res.json({ success: true, data: gigData[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get my posted gigs with stats
// @route   GET /api/gigs/my
// @access  Private/Freelancer
exports.getMyGigs = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        const gigs = await Gig.aggregate([
            { $match: { freelancer_id: userId } },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'gigorders',
                    localField: '_id',
                    foreignField: 'gig_id',
                    as: 'orders'
                }
            },
            {
                $addFields: {
                    orders_count: { $size: '$orders' },
                    revenue: {
                        $reduce: {
                            input: '$orders',
                            initialValue: 0,
                            in: { $add: ['$$value', { $cond: [{ $eq: ['$$this.payment_status', 'paid'] }, '$$this.price', 0] }] }
                        }
                    },
                    rating: 4.8 // Mock rating for now as review system is pending
                }
            },
            { $project: { orders: 0 } }
        ]);

        res.json({ success: true, data: gigs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update a gig
// @route   PUT /api/gigs/:id
// @access  Private/Freelancer
exports.updateGig = async (req, res) => {
    try {
        let gig = await Gig.findById(req.params.id);

        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        // Make sure user is gig owner
        if (gig.freelancer_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to update this gig' });
        }

        const file = Array.isArray(req.files) ? req.files.find(f => f.fieldname === 'thumbnail' || f.fieldname === 'gig_image') || req.files[0] : null;
        if (file) {
            req.body.thumbnail = `/uploads/gigs/${file.filename}`;
        }

        gig = await Gig.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.json({ success: true, data: gig });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a gig
// @route   DELETE /api/gigs/:id
// @access  Private/Freelancer
exports.deleteGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);

        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        // Make sure user is gig owner
        if (gig.freelancer_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Not authorized to delete this gig' });
        }

        await gig.deleteOne();

        res.json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
