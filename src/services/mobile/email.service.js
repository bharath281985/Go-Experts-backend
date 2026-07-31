"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = exports.sendPasswordResetEmail = exports.sendWelcomeEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const email_template_js_1 = require("./email.template.js");
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT || '2525'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const fromEmail = process.env.SMTP_FROM || 'noreply@goexperts.in';
const sendEmail = async (to, subject, html) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log(`[DEV MODE] Email skipped. To: ${to}, Subject: ${subject}`);
        return true; // Simulate success
    }
    try {
        await transporter.sendMail({
            from: fromEmail,
            to,
            subject,
            html,
        });
        return true;
    }
    catch (error) {
        console.error('Failed to send email:', error);
        return false;
    }
};
exports.sendEmail = sendEmail;
const sendWelcomeEmail = (to, name) => {
    const html = `<h1>Welcome to Go Experts, ${name}!</h1><p>We're glad to have you on board.</p>`;
    return (0, exports.sendEmail)(to, 'Welcome to Go Experts', html);
};
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendPasswordResetEmail = (to, code) => {
    const html = email_template_js_1.EmailTemplateEngine.getOtpLayout(
        'Reset Your Password',
        'We received a request to reset your password. Use the 6-digit verification code below to set a new password.',
        code
    );
    return (0, exports.sendEmail)(to, 'Reset Your Password - GoExperts', html);
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const sendVerificationEmail = (to, code) => {
    const html = email_template_js_1.EmailTemplateEngine.getOtpLayout(
        'Verify Your Email Address',
        'Use the 6-digit verification code below to complete your email verification.',
        code
    );
    return (0, exports.sendEmail)(to, 'Verify Your Email - GoExperts', html);
};
exports.sendVerificationEmail = sendVerificationEmail;
