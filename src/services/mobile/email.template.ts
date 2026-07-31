export class EmailTemplateEngine {
  /**
   * Replaces placeholders in a template with actual values.
   * e.g., compile('Hello {{name}}', { name: 'John' }) => 'Hello John'
   */
  static compile(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
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
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset</h2>
        <p>Hi {{name}},</p>
        <p>You requested a password reset. Use the following code:</p>
        <h3>{{code}}</h3>
      </div>
    `,
    VERIFY_EMAIL: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Verify your Email</h2>
        <p>Hi {{name}},</p>
        <p>Please use this code to verify your account:</p>
        <h3>{{code}}</h3>
      </div>
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
