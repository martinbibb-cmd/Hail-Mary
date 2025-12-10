/**
 * Email Service
 * 
 * Handles sending emails via Cloudflare Worker
 */

const WORKER_URL = 'https://hail-mary.martinbibb.workers.dev';

interface SendEmailRequest {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface SendEmailResponse {
  success: boolean;
  error?: string;
}

/**
 * Send an email via the Cloudflare Worker
 */
async function sendEmailViaWorker(emailData: SendEmailRequest): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Worker email send failed (${response.status}):`, errorText);
      return false;
    }

    const result: SendEmailResponse = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to send email via worker:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<boolean> {
  const subject = 'Reset Your Hail-Mary Password';
  
  const text = `
Hello,

You requested to reset your password for Hail-Mary.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

Best regards,
The Hail-Mary Team
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔑 Reset Your Password</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You requested to reset your password for <strong>Hail-Mary</strong>.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" 
         style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="font-size: 14px; color: #667eea; word-break: break-all; margin-bottom: 20px;">
      ${resetUrl}
    </p>
    
    <p style="font-size: 14px; color: #666; margin-bottom: 20px;">
      <strong>This link will expire in 1 hour.</strong>
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #999; margin-bottom: 0;">
      If you didn't request this, you can safely ignore this email.
    </p>
    
    <p style="font-size: 14px; color: #999; margin-top: 20px;">
      Best regards,<br>
      <strong>The Hail-Mary Team</strong>
    </p>
  </div>
</body>
</html>
  `.trim();

  try {
    const success = await sendEmailViaWorker({
      to: email,
      subject,
      text,
      html,
    });

    if (success) {
      console.log(`✉️  Password reset email sent to: ${email}`);
    } else {
      console.error(`❌ Failed to send password reset email to: ${email}`);
    }

    return success;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}
