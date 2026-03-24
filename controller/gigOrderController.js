const GigOrder = require('../models/GigOrder');
const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Get all gig orders for Admin
// @route   GET /api/admin/gig-orders
// @access  Private/Admin
exports.getAdminGigOrders = async (req, res) => {
    try {
        const orders = await GigOrder.find({})
            .populate('gig_id', 'title thumbnail')
            .populate('buyer_id', 'full_name email profile_image')
            .populate('seller_id', 'full_name email profile_image')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single gig order details
// @route   GET /api/admin/gig-orders/:id
// @access  Private/Admin
exports.getAdminGigOrderById = async (req, res) => {
    try {
        const order = await GigOrder.findById(req.params.id)
            .populate('gig_id')
            .populate('buyer_id', 'full_name email profile_image created_at')
            .populate('seller_id', 'full_name email profile_image rating completed_orders');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update gig order status (Admin)
// @route   PUT /api/admin/gig-orders/:id/status
// @access  Private/Admin
exports.updateGigOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['in_progress', 'delivered', 'completed', 'cancelled', 'refunded'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await GigOrder.findByIdAndUpdate(req.params.id, { status }, { new: true });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Handle specific logic for completion/refund if needed
        if (status === 'completed') {
            // Potentially release funds to seller wallet, increment completed orders, etc.
            await User.findByIdAndUpdate(order.seller_id, { $inc: { completed_orders: 1 } });
        }

        res.status(200).json({
            success: true,
            message: `Order status updated to ${status}`,
            order
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new gig order
// @route   POST /api/gig-orders
// @access  Private
exports.createGigOrder = async (req, res) => {
    try {
        const { gig, package, price, requirements } = req.body;

        const gigData = await Gig.findById(gig);
        if (!gigData) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        const service_fee = Math.round(price * 0.05); // 5% service fee
        const total_amount = price + service_fee;

        const order = await GigOrder.create({
            gig_id: gig,
            buyer_id: req.user.id,
            seller_id: gigData.freelancer_id,
            package: package || 'standard',
            price: price,
            service_fee,
            total_amount,
            requirements,
            status: 'pending',
            payment_status: 'pending'
        });

        // Add order ID for reference (GE-XXXXXX)
        order.orderID = 'GE-' + order._id.toString().slice(-6).toUpperCase();
        await order.save();

        res.status(201).json({
            success: true,
            data: order
        });
    } catch (error) {
        console.error('Create Order Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get my gig orders (as buyer or seller)
// @route   GET /api/gig-orders/my
// @access  Private
exports.getMyGigOrders = async (req, res) => {
    try {
        const orders = await GigOrder.find({
            $or: [{ buyer_id: req.user.id }, { seller_id: req.user.id }]
        })
            .populate('gig_id', 'title thumbnail')
            .populate('buyer_id', 'full_name profile_image')
            .populate('seller_id', 'full_name profile_image')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: orders
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
