const nodemailer = require("nodemailer");

async function test() {
  console.log("Creating transporter...");
  const transporter = nodemailer.createTransport({
    host: "mail.goexperts.in",
    port: 465,
    secure: true, // Use SSL/TLS for port 465
    auth: {
      user: "servicedesk@goexperts.in",
      pass: "4bq+l7hDIx&.JpnC",
    },
    debug: true, // Enable debug output
    logger: true // Log information to console
  });

  try {
    console.log("Verifying connection...");
    await transporter.verify();
    console.log("Connection verified. Sending email...");

    const info = await transporter.sendMail({
      from: '"Go Experts Support" <servicedesk@goexperts.in>',
      to: "vinod.goexperts@gmail.com",
      subject: "Test Email from Local Script",
      text: "This is a direct test from nodemailer.",
    });

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("FAILED TO SEND EMAIL:", error);
  }
}

test();
