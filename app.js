const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const dailyPointsExpiry = require('./utils/cronJobs');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Connect to Redis
// connectRedis();

// Initialize Cron Jobs
dailyPointsExpiry();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());

// Set Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" } // Required for local image loading if needed
}));

// Set static folder for uploads
app.use('/uploads/branding', express.static(path.join(__dirname, 'uploads/branding')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/auth', require('./routers/authRoutes'));
app.use('/api/mobile/auth', require('./routers/mobile/mobileAuthRoutes'));
app.use('/api/mobile/user', require('./routers/mobile/mobileUserRoutes'));
app.use('/api/mobile/kyc', require('./routers/mobile/mobileKycRoutes'));
app.use('/api/mobile/subscription-plans', require('./routers/mobile/mobileSubscriptionPlanRoutes'));
app.use('/api/users', require('./routers/userRoutes'));
app.use('/api/projects', require('./routers/projectRoutes'));
app.use('/api/gigs', require('./routers/gigRoutes'));
app.use('/api/registration-steps', require('./routers/registrationStepRoutes'));
app.use('/api/admin', require('./routers/adminRoutes'));
app.use('/api/cms', require('./routers/cmsRoutes'));
app.use('/api/gig-orders', require('./routers/gigOrderRoutes'));
app.use('/api/contact', require('./routers/contactRoutes'));
app.use('/api/messages', require('./routers/messageRoutes'));
app.use('/api/invitations', require('./routers/invitationRoutes'));
app.use('/api/subscription-plans', require('./routers/subscriptionPlanRoutes'));
app.use('/api/subscription', require('./routers/subscriptionRoutes'));
app.use('/api/payment', require('./routers/paymentRoutes'));
app.use('/api/startup-ideas', require('./routers/startupIdeaRoutes'));
app.use('/api/startup-categories', require('./routers/startupCategoryRoutes'));
app.use('/api/investor', require('./routers/investorRoutes'));
app.use('/api/meetings', require('./routers/meetingRoutes'));
app.use('/api/kyc', require('./routers/kycRoutes'));
app.use('/api/reviews', require('./routers/reviewRoutes'));
app.use('/api/wallet', require('./routers/walletRoutes'));


// Root Route
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa;">
            <div style="text-align: center; padding: 40px; border-radius: 20px; background: white; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <h1 style="color: #044071; margin-bottom: 20px; font-size: 2.5rem;">
                    📦 Welcome to Go Experts 🚀 🧪
                </h1>
                <p style="color: #6c757d; font-size: 1.1rem;">API is running smoothly</p>
            </div>
        </div>
    `);
});

const http = require('http');
const socketHandler = require('./utils/socket');

const server = http.createServer(app);

// Initialize Socket.io
socketHandler.init(server);

// Error handling middleware (to be added)

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
