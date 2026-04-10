const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'User no longer exists' });
            }

            return next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles) {
            return res.status(403).json({
                success: false,
                message: 'No authorization roles found for this user'
            });
        }
        if (!roles.some(role => req.user.roles.includes(role))) {
            return res.status(403).json({
                success: false,
                message: `User role is not authorized to access this route`
            });
        }
        next();
    };
};

const optionalProtect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            return next();
        } catch (error) {
            // Ignore error and continue as guest
            return next();
        }
    }

    next();
};

module.exports = { protect, authorize, optionalProtect };
