import nodemailer from "nodemailer";
import type { SendEmailOptions, SendEmailResult } from "@/lib/types/smtp";
import { getErrorMessage } from "@/lib/types/errors";
import { TIMEOUT_CONFIG } from "@/lib/config/timeouts";

export interface SmtpSendConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from?: string;
}

export async function sendEmail(
  smtpConfig: SmtpSendConfig,
  { to, subject, text, html, attachments }: SendEmailOptions
): Promise<SendEmailResult> {
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    throw new Error("SMTP configuration is incomplete. Please finish setting up your email configuration in Settings.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user.trim(),
      pass: smtpConfig.pass.trim(),
    },
    connectionTimeout: TIMEOUT_CONFIG.SMTP_CONNECTION,
    socketTimeout: TIMEOUT_CONFIG.SMTP_SOCKET,
    greetingTimeout: TIMEOUT_CONFIG.SMTP_GREETING,
    tls: {
      rejectUnauthorized: true,
    },
  });

  // Convert base64 attachments to Buffer format for nodemailer
  interface NodemailerAttachment {
    filename: string;
    content?: Buffer | string;
    contentType?: string;
  }

  const formattedAttachments: NodemailerAttachment[] | undefined = attachments?.map((att) => {
    const attachment: NodemailerAttachment = {
      filename: att.filename,
    };

    if (att.content) {
      if (typeof att.content === 'string') {
        attachment.content = Buffer.from(att.content, 'base64');
      } else {
        attachment.content = att.content;
      }
    }

    if (att.contentType) {
      attachment.contentType = att.contentType;
    }

    return attachment;
  });

  const mailOptions = {
    from: smtpConfig.from || smtpConfig.user,
    to,
    subject,
    text,
    html,
    attachments: formattedAttachments,
  };

  try {
    console.log(`[SMTP] Attempting to verify connection to ${smtpConfig.host}:${smtpConfig.port}...`);
    try {
      await transporter.verify();
      console.log(`[SMTP] Connection verified successfully`);
    } catch (verifyError: unknown) {
      const errorMessage = getErrorMessage(verifyError);
      console.warn(`[SMTP] Connection verification failed, but continuing anyway:`, errorMessage);
      // Continue anyway - some servers don't support verify() but can still send emails
    }

    // Send email with timeout
    console.log(`[SMTP] Sending email to ${to}...`);
    const startTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const duration = Date.now() - startTime;
    console.log(`[SMTP] Email sent successfully in ${duration}ms. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId || '',
    };
  } catch (error: unknown) {
    console.error("[SMTP] Error sending email:", error);

    // Type guard for nodemailer errors
    const isNodemailerError = (err: unknown): err is { code?: string; response?: string; message?: string } => {
      return typeof err === 'object' && err !== null;
    };

    // Provide more helpful error messages
    if (isNodemailerError(error)) {
      if (error.code === "ETIMEDOUT" || error.code === "ECONNRESET") {
        throw new Error(`SMTP connection timeout. Please check your network connection and SMTP server settings.`);
      } else if (error.code === "EAUTH") {
        const isExmail = smtpConfig.host?.includes("exmail.qq.com");
        const responseMessage = error.response || error.message || "";
        const isSystemBusy = responseMessage.toLowerCase().includes("system busy") || responseMessage.includes("535");

        if (isExmail) {
          let errorMsg = `SMTP authentication failed. `;

          if (isSystemBusy) {
            errorMsg += `The "system busy" error usually means:\n`;
            errorMsg += `1. You're using your regular password instead of an app-specific password\n`;
            errorMsg += `2. SMTP service might not be enabled in your account settings\n`;
            errorMsg += `3. Too many failed attempts (wait 5-10 minutes and try again)\n\n`;
            errorMsg += `Solution: Generate an app-specific password in Exmail Settings → Account → Email Binding, then use it in SMTP_PASS.`;
          } else {
            errorMsg += `Tencent Exmail requires an app-specific password (not your regular password). Please generate one in your Exmail settings and use it in SMTP_PASS.`;
          }

          throw new Error(errorMsg);
        } else {
          throw new Error(`SMTP authentication failed. Please check your email and password. If your email provider requires app passwords (Gmail, Outlook, etc.), use an app-specific password instead of your regular password.`);
        }
      } else if (error.code === "ECONNREFUSED") {
        throw new Error(`Cannot connect to SMTP server. Please check the host and port in your email configuration.`);
      } else if (error.code === "EENVELOPE" || error.code === "EMESSAGE") {
        // Invalid email address or envelope error
        const responseMessage = error.response || error.message || "";
        const isInvalidAddress =
          responseMessage.toLowerCase().includes("invalid") ||
          responseMessage.toLowerCase().includes("address") ||
          responseMessage.toLowerCase().includes("recipient") ||
          responseMessage.toLowerCase().includes("550") || // Mailbox unavailable
          responseMessage.toLowerCase().includes("551") || // User not local
          responseMessage.toLowerCase().includes("553");   // Mailbox name not allowed

        if (isInvalidAddress) {
          throw new Error(`Invalid email address: ${to}. Please check the recipient email address.`);
        }
      }

      // Check for invalid email address in response message (common SMTP error codes)
      const responseMessage = error.response || error.message || "";
      if (
        responseMessage.includes("550") || // Mailbox unavailable
        responseMessage.includes("551") || // User not local
        responseMessage.includes("553") || // Mailbox name not allowed
        responseMessage.toLowerCase().includes("invalid recipient") ||
        responseMessage.toLowerCase().includes("user unknown") ||
        responseMessage.toLowerCase().includes("mailbox does not exist")
      ) {
        throw new Error(`Invalid email address: ${to}. The recipient email address does not exist or is invalid.`);
      }
    }

    // Fallback to generic error message
    const errorMessage = getErrorMessage(error);
    throw new Error(`SMTP error: ${errorMessage}`);
  }
}
