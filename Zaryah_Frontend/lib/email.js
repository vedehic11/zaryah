import nodemailer from 'nodemailer';

/**
 * Create a nodemailer transporter for Gmail SMTP
 */
export function createEmailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send email verification link
 */
export async function sendVerificationEmail({ to, username, verificationUrl }) {
  const transporter = createEmailTransporter();

  const mailOptions = {
    from: `"Zaryah" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify Your Email - Zaryah',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Zaryah!</h1>
            </div>
            <div class="content">
              <p>Hi ${username || 'there'},</p>
              <p>Thank you for registering with Zaryah! Please verify your email address to complete your registration.</p>
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
              <p><strong>This link will expire in 24 hours.</strong></p>
              <p>If you didn't create an account with Zaryah, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Zaryah. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${username || 'there'},

Thank you for registering with Zaryah! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with Zaryah, you can safely ignore this email.

© ${new Date().getFullYear()} Zaryah. All rights reserved.`,
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Send seller approval notification
 */
export async function sendSellerApprovalEmail({ to, businessName, username, approved }) {
  const transporter = createEmailTransporter();

  const subject = approved 
    ? 'Congratulations! Your Seller Account is Approved - Zaryah'
    : 'Seller Application Update - Zaryah';

  const content = approved
    ? `
      <p>Great news! Your seller account for <strong>${businessName}</strong> has been approved.</p>
      <p>You can now:</p>
      <ul>
        <li>Add products to your store</li>
        <li>Manage your inventory</li>
        <li>View your seller dashboard</li>
        <li>Access your storefront at: <a href="${process.env.NEXT_PUBLIC_APP_URL}/${username}">${process.env.NEXT_PUBLIC_APP_URL}/${username}</a></li>
      </ul>
      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/seller/dashboard" class="button">Go to Seller Dashboard</a>
      </div>
    `
    : `
      <p>We've reviewed your seller application for <strong>${businessName}</strong>.</p>
      <p>Unfortunately, we're unable to approve your account at this time. Please contact our support team for more information.</p>
      <div style="text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/support" class="button">Contact Support</a>
      </div>
    `;

  const mailOptions = {
    from: `"Zaryah" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            ul { margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${approved ? '🎉 Account Approved!' : 'Application Update'}</h1>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Zaryah. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
}
