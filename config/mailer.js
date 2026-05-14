const nodemailer = require('nodemailer');

// Check if real email credentials are configured
const emailConfigured =
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com' &&
    process.env.EMAIL_PASS !== 'your_gmail_app_password';

// Only create a real transporter if credentials are set
const transporter = emailConfigured
    ? nodemailer.createTransport({
          service: 'gmail',
          auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS,
          },
      })
    : null;

/**
 * Send an email-verification link to a newly registered user.
 * @param {string} toEmail  - Recipient's email address
 * @param {string} token    - The unique verification token
 */
async function sendVerificationEmail(toEmail, token) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}`;

    const mailOptions = {
        from: `"SurveyBuilder" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: 'Verify your SurveyBuilder account',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="margin:0;padding:0;background:#0f0c29;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0c29;padding:40px 0;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0"
                     style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
                            border-radius:16px;border:1px solid rgba(255,255,255,0.1);
                            overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#667eea,#764ba2);
                              padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;
                               letter-spacing:-0.5px;">
                      ✉️ Verify Your Email
                    </h1>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 36px;">
                    <p style="margin:0 0 16px;color:#c5c5e8;font-size:15px;line-height:1.6;">
                      Hi there! Thanks for signing up for <strong style="color:#fff;">SurveyBuilder</strong>.
                    </p>
                    <p style="margin:0 0 28px;color:#c5c5e8;font-size:15px;line-height:1.6;">
                      Click the button below to verify your email address and activate your account.
                      This link expires in <strong style="color:#fff;">24 hours</strong>.
                    </p>
                    <!-- CTA Button -->
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding:0 0 28px;">
                          <a href="${verifyUrl}"
                             style="display:inline-block;padding:14px 40px;
                                    background:linear-gradient(135deg,#667eea,#764ba2);
                                    color:#fff;font-size:16px;font-weight:600;
                                    text-decoration:none;border-radius:10px;
                                    letter-spacing:0.3px;">
                            ✅ Verify My Email
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 8px;color:#8888aa;font-size:13px;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="margin:0;word-break:break-all;">
                      <a href="${verifyUrl}"
                         style="color:#667eea;font-size:13px;text-decoration:underline;">
                        ${verifyUrl}
                      </a>
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.08);
                              text-align:center;">
                    <p style="margin:0;color:#555577;font-size:12px;line-height:1.5;">
                      If you didn't create a SurveyBuilder account, you can safely ignore this email.<br>
                      © 2026 SurveyBuilder. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        `,
    };

    // ── DEV MODE: no email credentials configured ─────────────────────────────
    if (!emailConfigured) {
        console.log('\n' + '='.repeat(65));
        console.log('📧  DEV MODE — Email not configured. Verification link below:');
        console.log('='.repeat(65));
        console.log(`➡️  ${verifyUrl}`);
        console.log('='.repeat(65) + '\n');
        return; // skip actual sending
    }

    // ── PRODUCTION: send real email ───────────────────────────────────────────
    await transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
