"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailTemplateEngine = void 0;
class EmailTemplateEngine {
    /**
     * Replaces placeholders in a template with actual values.
     * e.g., compile('Hello {{name}}', { name: 'John' }) => 'Hello John'
     */
    static compile(template, data) {
        return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }
    // Universal Industry-Level HTML OTP Layout
    static getOtpLayout(title, description, code) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 40px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border: 1px solid #eef1f6;">
    <div style="text-align: center; margin-bottom: 30px;">
      <span style="font-size: 24px; font-weight: 800; color: #1a1f36; letter-spacing: -0.5px;">Go<span style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; padding: 4px 10px; border-radius: 6px;">Experts</span></span>
    </div>
    <h1 style="font-size: 22px; font-weight: 700; color: #1a1f36; margin-bottom: 12px; text-align: center;">${title}</h1>
    <p style="font-size: 15px; color: #4f566b; line-height: 1.6; margin: 0 0 24px; text-align: center;">${description}</p>
    <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 28px 0;">
      <div style="font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #4f46e5; font-family: 'Courier New', Courier, monospace; margin-left: 12px;">${code}</div>
      <div style="display: inline-block; margin-top: 12px; background: #fee2e2; color: #dc2626; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 20px;">⏱ Expires in 10 minutes</div>
    </div>
    <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 8px; font-size: 13px; color: #1e40af; margin-bottom: 30px; text-align: left;">
      🔒 <strong>Security Warning:</strong> Never share this code with anyone. GoExperts support will never ask for your OTP.
    </div>
    <div style="text-align: center; font-size: 12px; color: #a3acb9; border-top: 1px solid #f1f5f9; padding-top: 24px;">
      <p style="margin-bottom: 8px;">If you didn't request this code, you can safely ignore this email.</p>
      <p>© 2026 GoExperts. All rights reserved. • <a href="https://goexperts.in/privacy" style="color: #6366f1; text-decoration: none;">Privacy Policy</a></p>
    </div>
  </div>
</body>
</html>`;
    }

    // Define reusable HTML templates
    static templates = {
        WELCOME: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Go Experts, {{name}}!</h2>
        <p>We're thrilled to have you on board. Explore the platform and find top opportunities.</p>
      </div>
    `,
        RESET_PASSWORD: `
      {{otpLayoutResetPassword}}
    `,
        VERIFY_EMAIL: `
      {{otpLayoutVerifyEmail}}
    `,
        PAYMENT_SUCCESS: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Payment Successful</h2>
        <p>Hi {{name}},</p>
        <p>Your payment of {{amount}} was successful for {{planName}}.</p>
        <p>Transaction ID: {{transactionId}}</p>
      </div>
    `,
        MEETING_INVITATION: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Meeting Scheduled</h2>
        <p>Hi {{name}},</p>
        <p>You have a new meeting: <strong>{{meetingTitle}}</strong></p>
        <p>Date: {{date}} at {{time}}</p>
        <p><a href="{{link}}">Join Meeting</a></p>
      </div>
    `,
        SECURITY_ALERT: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: red;">
        <h2>Security Alert</h2>
        <p>Hi {{name}},</p>
        <p>We detected a new login from a new device ({{device}}) at {{ip}}.</p>
        <p>If this was not you, please change your password immediately.</p>
      </div>
    `
    };
}
exports.EmailTemplateEngine = EmailTemplateEngine;
