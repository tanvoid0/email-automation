import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/smtp";

export const dynamic = "force-dynamic";

// Set to false to enable real email sending
// When SMTP is configured, set this to false
const MOCK_EMAIL = process.env.SMTP_HOST ? false : true;

export async function GET() {
  // Test email endpoint
  const testEmail = process.env.SMTP_TEST_EMAIL;
  
  if (!testEmail) {
    return NextResponse.json(
      { error: "SMTP_TEST_EMAIL is not configured in environment variables" },
      { status: 400 }
    );
  }

  if (MOCK_EMAIL) {
    if (process.env.NODE_ENV === "development") {
      console.log("=".repeat(60));
      console.log("📧 TEST EMAIL (MOCK MODE)");
      console.log("=".repeat(60));
      console.log("To:", testEmail);
      console.log("Subject: Test Email - SMTP Configuration");
      console.log("From:", process.env.SMTP_FROM || "[REDACTED]");
      console.log("\nEmail Body:");
      console.log("This is a test email to verify your SMTP configuration is working correctly.");
      console.log("=".repeat(60));
      console.log("✅ Test email would be sent successfully (MOCK MODE)");
      console.log("=".repeat(60));
    } else {
      console.log(`[Mock Test Email] Would send to ${testEmail}`);
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully (MOCK MODE)",
      to: testEmail,
      mocked: true,
    });
  }

  try {
    // Increased timeout to 60 seconds for test emails (allows more time for slow connections)
    const timeoutMs = parseInt(process.env.SMTP_TEST_TIMEOUT || "60000");
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs / 1000} seconds`)), timeoutMs);
    });

    if (process.env.NODE_ENV === "development") {
      console.log(`[Email API] Sending test email to ${testEmail} (timeout: ${timeoutMs}ms)...`);
      console.log(`[Email API] SMTP Config: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    }
    
    const emailPromise = sendEmail({
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
  // Set a timeout for the entire request (25 seconds)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout after 25 seconds")), 25000);
  });

  try {
    const body = await request.json();
    const { to, subject, text, html, attachments } = body;

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, and text or html" },
        { status: 400 }
      );
    }

    if (MOCK_EMAIL) {
      // Mock email sending - logs to console instead of actually sending
      // Note: In production, avoid logging full email content to protect privacy
      if (process.env.NODE_ENV === "development") {
        console.log("=".repeat(60));
        console.log("📧 MOCK EMAIL SEND (Email sending is mocked)");
        console.log("=".repeat(60));
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log("From:", process.env.SMTP_FROM || "[REDACTED]");
        console.log("\nEmail Body:");
        console.log(text || html);
        if (attachments && attachments.length > 0) {
          console.log("\nAttachments:", attachments.map((a: any) => a.filename).join(", "));
        }
        console.log("=".repeat(60));
        console.log("✅ Email would be sent successfully");
        console.log("=".repeat(60));
      } else {
        // In production, only log minimal info
        console.log(`[Mock Email] Would send to ${to}, subject: ${subject}`);
      }

      // Simulate a small delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      return NextResponse.json({
        success: true,
        messageId: `mock-${Date.now()}@email-automation.local`,
        mocked: true,
      });
    }

    // Real email sending with timeout
    console.log(`[Email API] Starting email send to ${to}...`);
    const emailPromise = sendEmail({
      to,
      subject,
      text,
      html,
      attachments,
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
    console.error("Email API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

