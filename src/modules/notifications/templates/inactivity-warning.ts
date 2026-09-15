import { baseEmailLayout } from "./layout.js";

export function getInactivityWarningEmail(userName: string, industry: string | null | undefined, daysInactive: number): string {
  const daysLeft = 31 - daysInactive;
  
  let industryMessage = "We miss having you on the Go Experts platform! Discover new opportunities and connect with professionals.";
  
  if (industry) {
    const ind = industry.toLowerCase();
    if (ind.includes("software") || ind.includes("tech") || ind.includes("it ")) {
      industryMessage = "The tech world moves fast! Log back in to discover new software projects, talented developers, and cutting-edge startups on Go Experts.";
    } else if (ind.includes("finance") || ind.includes("accounting") || ind.includes("investment")) {
      industryMessage = "Stay ahead of the curve. Log back in to see the latest financial opportunities and connect with top founders and investors.";
    } else if (ind.includes("health") || ind.includes("medical")) {
      industryMessage = "Healthcare innovation never stops. Log back in to explore the latest healthtech opportunities and medical experts.";
    } else if (ind.includes("marketing") || ind.includes("design") || ind.includes("creative")) {
      industryMessage = "Keep your creative edge sharp. Log back in to discover new design projects and connect with marketing visionaries.";
    } else {
      // Fallback utilizing the industry name
      industryMessage = `New opportunities in ${industry} are waiting for you! Log back in to see what you've missed on Go Experts.`;
    }
  }

  const innerHtml = `
    <h2 style="margin-top: 0; color: #111827;">Hello ${userName || 'there'},</h2>
    <p>${industryMessage}</p>
    <p>We noticed you haven't logged in for <strong>${daysInactive} days</strong>. To ensure our community remains active and engaged, accounts are automatically set to inactive after 31 days.</p>
    <p style="color: #e30613; font-weight: 600;">Your account will be marked as inactive in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}.</p>
    <p>Simply log in to your account to keep it active.</p>
    <a href="https://goexperts.in/login" class="btn">Log In Now</a>
  `;

  return baseEmailLayout("Action Required: Keep Your Account Active", innerHtml);
}
