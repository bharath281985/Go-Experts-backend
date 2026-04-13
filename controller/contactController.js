const ContactMessage = require('../models/ContactMessage');
const OTP = require('../models/OTP');
const sendEmail = require('../utils/sendEmail');
const SiteSettings = require('../models/SiteSettings');
const User = require('../models/User');

// Helper to generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendContactOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const otp = generateOTP();

        // Save or Update OTP in DB
        await OTP.findOneAndUpdate(
            { email: email.toLowerCase() },
            { otp, createdAt: new Date() },
            { upsert: true, new: true }
        );

        // Send OTP via Email
        await sendEmail({
            email,
            subject: 'Email Verification OTP - Go Experts',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #F24C20;">Verify your identity</h2>
                    <p>You requested an inquiry on Go Experts. Use this OTP to verify your email:</p>
                    <div style="padding: 15px; background: #f4f4f4; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #F24C20;">
                        ${otp}
                    </div>
                    <p>This code is valid for 5 minutes. Please do not share it with anyone.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Verification OTP sent to your email' });
    } catch (error) {
        console.error('sendContactOTP error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
};

exports.verifyContactOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

        const record = await OTP.findOne({ email: email.toLowerCase(), otp });

        if (!record) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // Successfully verified
        res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
};

exports.submitContactMessage = async (req, res) => {
    try {
        const { name, email, phoneNumber, subject, message, otp } = req.body;

        // Final verification for security
        const otpRecord = await OTP.findOne({ email: email.toLowerCase(), otp });
        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Please verify your email with a valid OTP first' });
        }

        // Create message
        const contactMessage = await ContactMessage.create({
            name,
            email: email.toLowerCase(),
            phoneNumber,
            subject,
            message
        });

        // Delete successful OTP record
        await OTP.deleteOne({ _id: otpRecord._id });

        // Get site settings for admin email
        const settings = await SiteSettings.findById('site_settings');
        const adminEmail = settings?.contact_email || process.env.EMAIL_USER;

        // Send confirmation email to user
        await sendEmail({
            email: email.toLowerCase(),
            subject: 'Inquiry Received - Go Experts',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #F24C20;">Thak you for reaching out!</h2>
                    <p>Hello ${name},</p>
                    <p>We've received your inquiry regarding <b>${subject}</b>. Our team will get back to you shortly.</p>
                    <hr/>
                    <p><small>Reference ID: ${contactMessage._id}</small></p>
                </div>
            `
        });

        // Optional: Notify Admin
        if (adminEmail) {
            await sendEmail({
                email: adminEmail,
                subject: `New Inquiry: ${subject}`,
                html: `
                    <p><b>From:</b> ${name} (${email})</p>
                    <p><b>Phone:</b> ${phoneNumber || 'N/A'}</p>
                    <p><b>Message:</b></p>
                    <p>${message}</p>
                `
            });
        }

        res.status(201).json({ success: true, message: 'Your inquiry has been submitted successfully!', data: contactMessage });
    } catch (error) {
        console.error('submitContactMessage error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit inquiry' });
    }
};

exports.contactFreelancer = async (req, res) => {
    try {
        const { freelancerId, name, email, subject, message } = req.body;

        if (!freelancerId || !name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const freelancer = await User.findById(freelancerId);
        if (!freelancer) {
            return res.status(404).json({ success: false, message: 'Freelancer not found' });
        }

        // Send email to freelancer
        await sendEmail({
            email: freelancer.email,
            subject: `Inquiry from Go Experts: ${subject}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #F24C20;">You have a new inquiry!</h2>
                    <p>Hello ${freelancer.full_name},</p>
                    <p>A visitor on your Go Experts profile has sent you a message:</p>
                    <div style="background: #fdfdfd; padding: 20px; border: 1px solid #eee; border-radius: 12px; margin-top: 20px;">
                        <p><b>From:</b> ${name} (<a href="mailto:${email}">${email}</a>)</p>
                        <p><b>Subject:</b> ${subject}</p>
                        <p><b>Message:</b></p>
                        <p style="white-space: pre-line;">${message}</p>
                    </div>
                    <p style="margin-top: 20px; font-size: 13px; color: #777;">
                        Do not reply directly to this email. Use the contact information provided above to get in touch with the sender.
                    </p>
                </div>
            `
        });

        // Send confirmation email to sender
        await sendEmail({
            email,
            subject: `Message Sent to ${freelancer.full_name} - Go Experts`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #F24C20;">Message Delivered</h2>
                    <p>Hello ${name},</p>
                    <p>Your message has been successfully sent to <b>${freelancer.full_name}</b>.</p>
                    <p>They will contact you directly via your email (${email}) if they are interested.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Your message has been sent to the freelancer!' });
    } catch (error) {
        console.error('contactFreelancer error:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
};
