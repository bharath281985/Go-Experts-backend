const nodemailer = require('nodemailer');
const SiteSettings = require('../models/SiteSettings');
const EmailTemplate = require('../models/EmailTemplate');

const sendEmail = async (options) => {
    // Fetch settings from DB
    let settings = await SiteSettings.findById('site_settings');

    // Fallback to env if DB record not found
    const host = settings?.smtp_host || process.env.EMAIL_HOST;
    const port = settings?.smtp_port || process.env.EMAIL_PORT;
    const user = settings?.smtp_user || process.env.EMAIL_USER;
    const pass = settings?.smtp_pass || process.env.EMAIL_PASS;
    const fromName = settings?.email_from_name || process.env.FROM_NAME || 'Go Experts';
    const fromEmail = settings?.email_from || process.env.EMAIL_USER;
    const replyTo = settings?.email_reply_to || fromEmail;

    // Determine if secure (465 usually is)
    const secure = settings ? (settings.email_encryption === 'SSL' || settings.smtp_port === '465') : (process.env.EMAIL_SECURE === 'true');

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass
        },
        tls: {
            rejectUnauthorized: false // Helps with some shared hosting SMTPs
        }
    });

    let subject = options.subject;
    let html = options.html;
    let text = options.message;

    // Process Template if provided
    if (options.templateTrigger) {
        let template = await EmailTemplate.findOne({ trigger: options.templateTrigger });
        if (template && template.status === 'active') {
            subject = template.subject;
            html = template.body;

            // Replace variables like {name}, {link}, {otp}
            if (options.templateData) {
                for (const [key, value] of Object.entries(options.templateData)) {
                    const regex = new RegExp(`{${key}}`, 'g');
                    subject = subject.replace(regex, value);
                    html = html.replace(regex, value);
                }
            }
            text = html.replace(/<[^>]*>?/gm, ''); // Fallback plain text
        }
    }

    const message = {
        from: `${fromName} <${fromEmail}>`,
        to: options.email,
        subject: subject,
        text: text,
        html: html,
        replyTo
    };

    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
    return info;
};

module.exports = sendEmail;
