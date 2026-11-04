import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/smtp";
import { getUserSmtpConfig } from "@/lib/utils/smtpConfig";
import { getSession } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { UserProfileModel } from "@/lib/models/UserProfile";
import { TIMEOUT_CONFIG } from "@/lib/config/timeouts";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // 30 seconds - allows time for SMTP operations and attachment fetching

export async function GET() {
  // Test email endpoint - sends a test email to the logged-in user's own address
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const smtpConfig = await getUserSmtpConfig(session.username);
    if (!smtpConfig) {
      return NextResponse.json(
        { error: "Email (SMTP) is not configured yet. Set it up in Settings first." },
        { status: 400 }
      );
    }

    await connectDB();
    const profile = await UserProfileModel.findOne({ name: session.username }).lean();
    const testEmail = profile?.email || smtpConfig.user;

    const timeoutMs = TIMEOUT_CONFIG.SMTP_TEST;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs / 1000} seconds`)), timeoutMs);
    });

    console.log(`[Email API] Sending test email to ${testEmail} (timeout: ${timeoutMs}ms)...`);

    const emailPromise = sendEmail(smtpConfig, {
      to: testEmail,
      subject: "Test Email - SMTP Configuration",
      text: "This is a test email to verify your SMTP configuration is working correctly.\n\nIf you received this email, your SMTP settings are properly configured!",
      html: "<p>This is a test email to verify your SMTP configuration is working correctly.</p><p>If you received this email, your SMTP settings are properly configured!</p>",
    });

    try {
      const result = await Promise.race([emailPromise, timeoutPromise]) as any;
      console.log(`[Email API] Test email sent successfully to ${testEmail}`);
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully",
        to: testEmail,
        messageId: result.messageId,
      });
    } catch (timeoutError: any) {
      if (timeoutError.message?.includes("timeout")) {
        throw new Error(`Test email timed out after ${timeoutMs / 1000} seconds. The SMTP server may be slow, unreachable, or blocked by firewall. Please check your SMTP configuration and network settings.`);
      }
      throw timeoutError;
    }
  } catch (error: any) {
    console.error("[Email API] Test email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send test email" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set a timeout for the entire request
  const timeoutMs = TIMEOUT_CONFIG.EMAIL_API_REQUEST;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs / 1000} seconds`)), timeoutMs);
  });

  try {
    const smtpConfig = await getUserSmtpConfig(session.username);
    if (!smtpConfig) {
      return NextResponse.json(
        { error: "Email (SMTP) is not configured yet. Set it up in Settings first." },
        { status: 400 }
      );
    }

    // Log request metadata
    const contentType = request.headers.get("content-type") || "unknown";
    const contentLength = request.headers.get("content-length");
    console.log("[Email API] POST Request received:", {
      contentType,
      contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : "unknown",
      timestamp: new Date().toISOString(),
    });

    const body = await request.json();
    const { to, subject, text, html, attachments, attachmentIds } = body;

    // Calculate and log payload sizes (request payload only)
    const textSize = text ? Buffer.byteLength(text, 'utf8') : 0;
    const htmlSize = html ? Buffer.byteLength(html, 'utf8') : 0;
    const emailBodySize = Math.max(textSize, htmlSize);

    // Support both old format (full attachments) and new format (attachment IDs)
    let finalAttachments: any[] = [];
    let attachmentDetails: Array<{filename: string; size: number; sizeMB: string; contentType?: string}> = [];
    let totalAttachmentSize = 0;

    // Priority: attachmentIds (new format) > attachments (old format for backward compatibility)
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      // New format: Fetch attachments from database by IDs
      console.log("[Email API] Fetching attachments by IDs:", attachmentIds);
      await connectDB();

      // Filter valid ObjectIds
      const validIds = attachmentIds.filter((id: any): id is string => {
        if (typeof id === 'string') {
          return /^[0-9a-fA-F]{24}$/.test(id.trim());
        }
        return false;
      });

      if (validIds.length > 0) {
        const dbAttachments = await AttachmentModel.find({
          _id: { $in: validIds },
          userId: session.username,
        });

        finalAttachments = dbAttachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        }));

        attachmentDetails = dbAttachments.map((att: any) => {
          const contentSize = att.content ? Buffer.byteLength(att.content, 'base64') : 0;
          totalAttachmentSize += contentSize;
          return {
            filename: att.filename || 'unknown',
            size: contentSize,
            sizeMB: (contentSize / 1024 / 1024).toFixed(2),
            contentType: att.contentType || 'unknown',
          };
        });

        console.log("[Email API] Fetched attachments from database:", {
          requestedIds: validIds.length,
          found: dbAttachments.length,
          filenames: dbAttachments.map((a: any) => a.filename),
        });
      }
    } else if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      // Old format: attachments provided directly (backward compatibility)
      console.log("[Email API] Using attachments from request body (legacy format)");
      finalAttachments = attachments;
      attachmentDetails = attachments.map((att: any) => {
        const contentSize = att.content ? Buffer.byteLength(att.content, 'base64') : 0;
        totalAttachmentSize += contentSize;
        return {
          filename: att.filename || 'unknown',
          size: contentSize,
          sizeMB: (contentSize / 1024 / 1024).toFixed(2),
          contentType: att.contentType || 'unknown',
        };
      });
    }

    const totalPayloadSize = emailBodySize + totalAttachmentSize;
    const totalPayloadSizeMB = (totalPayloadSize / 1024 / 1024).toFixed(2);

    // Comprehensive logging
    console.log("[Email API] Email payload analysis:", {
      recipient: to,
      subject: subject?.substring(0, 50) + (subject?.length > 50 ? '...' : ''),
      emailBodySize: `${(emailBodySize / 1024).toFixed(2)} KB`,
      attachmentsCount: finalAttachments.length,
      totalAttachmentSize: `${(totalAttachmentSize / 1024 / 1024).toFixed(2)} MB`,
      totalPayloadSize: `${totalPayloadSizeMB} MB`,
      attachmentSource: attachmentIds ? 'database (by IDs)' : 'request body (legacy)',
      attachmentDetails: attachmentDetails.map(att => ({
        filename: att.filename,
        size: `${att.sizeMB} MB`,
        contentType: att.contentType,
      })),
      timestamp: new Date().toISOString(),
    });

    // Warn if payload is large
    if (totalPayloadSize > 4.5 * 1024 * 1024) { // 4.5 MB warning threshold
      console.warn("[Email API] ⚠️ Large payload detected:", {
        totalSizeMB: totalPayloadSizeMB,
        warning: "Payload may exceed server limits",
      });
    }

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and text or html" },
        { status: 400 }
      );
    }

    // Real email sending with timeout
    console.log(`[Email API] Starting email send to ${to}...`);
    const emailPromise = sendEmail(smtpConfig, {
      to,
      subject,
      text,
      html,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
    });

    try {
      const result = await Promise.race([emailPromise, timeoutPromise]) as any;
      console.log(`[Email API] Email sent successfully to ${to}`);
      return NextResponse.json(result);
    } catch (timeoutError: any) {
      if (timeoutError.message?.includes("timeout")) {
        throw new Error("Email sending timed out. The SMTP server may be slow or unreachable. Please check your SMTP configuration.");
      }
      throw timeoutError;
    }
  } catch (error: any) {
    console.error("[Email API] Error caught:", {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack?.substring(0, 500), // First 500 chars of stack
      timestamp: new Date().toISOString(),
    });

    // Check if it's a payload size error
    if (error.message?.includes("Entity Too Large") || error.message?.includes("PAYLOAD_TOO_LARGE") || error.message?.includes("413")) {
      console.error("[Email API] ❌ PAYLOAD TOO LARGE ERROR DETECTED");
      console.error("[Email API] This error typically occurs when the request size exceeds server limits (usually 4.5-6 MB)");
      console.error("[Email API] Check the payload size logs above to identify large attachments");
    }

    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
