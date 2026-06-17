const nodemailer = require('nodemailer');
const path = require('path');
const https = require('https');
const fs = require('fs');

const BRAND_NAME = 'NutriTrack';
const LOGO_CID = 'nutritrack-logo';
const RESET_LINK_EXPIRY_MINUTES = 15;

function buildTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        : undefined
    });
  }

  if (process.env.EMAIL && process.env.EMAIL_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  return null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSender(address) {
  if (!address) return null;
  return address.includes('<') ? address : `"${BRAND_NAME}" <${address}>`;
}

function stripSenderName(address) {
  const match = String(address || '').match(/<([^>]+)>/);
  return match ? match[1] : String(address || '').trim();
}

function postJson({ hostname, path: requestPath, headers, payload }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname,
      path: requestPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...headers
      }
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        responseBody += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseBody);
          return;
        }
        reject(new Error(`Email API failed with status ${res.statusCode}: ${responseBody}`));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function buildEmailContent({ resetLink, name }) {
  const displayName = String(name || '').trim();
  const safeName = escapeHtml(displayName);
  const htmlGreeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const textGreeting = displayName ? `Hi ${displayName},` : 'Hi,';
  const safeResetLink = escapeHtml(resetLink);
  const year = new Date().getFullYear();

  return {
    subject: 'Reset your NutriTrack password',
    html: `
      <div style="margin:0; padding:32px 16px; background:#f8fafc; font-family:Arial, sans-serif; color:#111827;">
        <div style="max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="padding:32px 32px 20px; text-align:center; border-bottom:1px solid #ecfdf5;">
            <h1 style="margin:0; color:#16a34a; font-size:28px; line-height:1.2;">${BRAND_NAME}</h1>
            <p style="margin:6px 0 0; color:#64748b; font-size:14px;">Daily Nutrition</p>
          </div>

          <div style="padding:32px; font-size:16px; line-height:1.6;">
            <p style="margin:0 0 18px;">${htmlGreeting}</p>
            <p style="margin:0 0 18px;">
              We received a request to reset the password for your ${BRAND_NAME} account.
              If this was you, use the button below to create a new password.
            </p>
            <p style="margin:0 0 24px; color:#0f172a;">
              This link expires in <strong>${RESET_LINK_EXPIRY_MINUTES} minutes</strong>.
            </p>
            <div style="text-align:center; margin:32px 0;">
              <a href="${safeResetLink}" style="display:inline-block; background:#16a34a; color:#ffffff; padding:14px 28px; border-radius:8px; text-decoration:none; font-weight:bold;">
                Reset Password
              </a>
            </div>
            <p style="margin:0 0 10px; color:#475569;">
              If the button does not work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 26px; word-break:break-all;">
              <a href="${safeResetLink}" style="color:#15803d;">${safeResetLink}</a>
            </p>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:28px 0;">
            <p style="margin:0 0 18px; color:#6b7280;">
              If you did not request this password reset, no action is required.
              Your password will remain unchanged.
            </p>
            <p style="margin:0; color:#9ca3af; font-size:13px;">
              This is an automated email from ${BRAND_NAME}. Please do not reply.
            </p>
            <p style="margin:8px 0 0; color:#9ca3af; font-size:13px;">
              &copy; ${year} ${BRAND_NAME}. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `${textGreeting}

We received a request to reset the password for your ${BRAND_NAME} account.
If this was you, open this link to create a new password:

${resetLink}

This link expires in ${RESET_LINK_EXPIRY_MINUTES} minutes.

If you did not request this password reset, no action is required. Your password will remain unchanged.

This is an automated email from ${BRAND_NAME}. Please do not reply.
Copyright ${year} ${BRAND_NAME}. All rights reserved.`
  };
}

async function sendViaEmailApi({ to, from, subject, html, text }) {
  if (process.env.SENDGRID_API_KEY) {
    await postJson({
      hostname: 'api.sendgrid.com',
      path: '/v3/mail/send',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`
      },
      payload: {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: stripSenderName(from), name: BRAND_NAME },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ]
      }
    });
    return true;
  }

  if (process.env.RESEND_API_KEY) {
    await postJson({
      hostname: 'api.resend.com',
      path: '/emails',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      payload: {
        from,
        to: [to],
        subject,
        html,
        text
      }
    });
    return true;
  }

  return false;
}

async function sendPasswordResetEmail({ to, resetLink, name }) {
  const transporter = buildTransporter();
  const from = formatSender(process.env.EMAIL_FROM || process.env.EMAIL || process.env.SMTP_USER);

  const apiFrom = formatSender(process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || process.env.RESEND_FROM_EMAIL);
  const content = buildEmailContent({ resetLink, name });
  const apiSent = apiFrom
    ? await sendViaEmailApi({ to, from: apiFrom, ...content })
    : false;

  if (apiSent) return;

  if (!transporter || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email service is not configured.');
    }

    console.warn(`Password reset email not sent because email is not configured. Reset link: ${resetLink}`);
    return;
  }

  const logoPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'nutritrack-logo.png');
  const attachments = fs.existsSync(logoPath)
    ? [
        {
          filename: 'nutritrack-logo.png',
          path: logoPath,
          cid: LOGO_CID
        }
      ]
    : [];

  await transporter.sendMail({
    from,
    to,
    subject: content.subject,
    html: attachments.length
      ? content.html.replace(`<h1 style="margin:0; color:#16a34a; font-size:28px; line-height:1.2;">${BRAND_NAME}</h1>`, `<img src="cid:${LOGO_CID}" width="60" height="60" alt="${BRAND_NAME} logo" style="display:block; margin:0 auto 12px; border-radius:12px;"><h1 style="margin:0; color:#16a34a; font-size:28px; line-height:1.2;">${BRAND_NAME}</h1>`)
      : content.html,
    text: content.text,
    attachments
  });
}

module.exports = { sendPasswordResetEmail };
