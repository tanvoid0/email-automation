import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { AttachmentModel } from "@/lib/models/Attachment";
import { sendEmail } from "@/lib/smtp";
import type { ProcessQueueRequest, ProcessQueueResponse, ApiErrorResponse } from "@/lib/types/api";
import type { EmailAttachment } from "@/lib/types/smtp";
import { getErrorMessage } from "@/lib/types/errors";
import { APP_MOCK_EMAIL_DOMAIN } from "@/lib/constants/app";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for batch processing

// Set to false to enable real email sending
const MOCK_EMAIL = process.env.SMTP_HOST ? false : true;

/**
 * Process email queue in batches
 * This endpoint processes emails server-side and updates progress
 */
export async function POST(request: NextRequest) {
  try {
    // In a real implementation, you'd read the queue from a shared state (Redis, DB, etc.)
    // For now, we'll process based on the queue state that should be managed client-side
    // The actual queue processing logic will be in the client with this API called for each batch
    
    return NextResponse.json({
      success: true,
      message: "Queue processing initiated",
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    console.error("[Process Queue] Error:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Process a single email from the queue
 * Called by the client for each email in a batch
 */
/**
 * Type guard for valid MongoDB ObjectId string
 */
function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id.trim());
}

export async function PUT(request: NextRequest) {
  let itemId: string | undefined;
  const requestStartTime = Date.now();
  
  try {
    console.log('[Process Queue API] PUT request received:', {
      timestamp: new Date().toISOString(),
      contentType: request.headers.get('content-type'),
      contentLength: request.headers.get('content-length'),
    });

    const body: ProcessQueueRequest = await request.json();
    const { 
      to, 
      subject, 
      text, 
      attachmentIds,
    } = body;
    
    itemId = body.itemId;

    console.log('[Process Queue API] Request body parsed:', {
      itemId,
      to,
      subject: subject?.substring(0, 50),
      textLength: text?.length || 0,
      attachmentIdsCount: attachmentIds?.length || 0,
      attachmentIds: attachmentIds,
      timestamp: new Date().toISOString(),
    });

    if (!to || !subject || !text) {
      const errorResponse: ApiErrorResponse = {
        error: "Missing required fields: to, subject, text",
      };
      console.error('[Process Queue API] Validation error:', {
        itemId,
        missingFields: {
          to: !to,
          subject: !subject,
          text: !text,
        },
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Fetch attachments from database
    const finalAttachments: EmailAttachment[] = [];
    if (attachmentIds && Array.isArray(attachmentIds) && attachmentIds.length > 0) {
      console.log('[Process Queue API] Fetching attachments:', {
        itemId,
        attachmentIdsCount: attachmentIds.length,
        attachmentIds: attachmentIds,
        timestamp: new Date().toISOString(),
      });

      try {
        await connectDB();
        
        const validIds = attachmentIds.filter(isValidObjectId);
        
        console.log('[Process Queue API] Valid attachment IDs:', {
          itemId,
          totalIds: attachmentIds.length,
          validIds: validIds.length,
          invalidIds: attachmentIds.length - validIds.length,
          timestamp: new Date().toISOString(),
        });
        
        if (validIds.length > 0) {
          const dbAttachments = await AttachmentModel.find({
            _id: { $in: validIds }
          });
          
          console.log('[Process Queue API] Attachments fetched from DB:', {
            itemId,
            requestedCount: validIds.length,
            foundCount: dbAttachments.length,
            missingCount: validIds.length - dbAttachments.length,
            filenames: dbAttachments.map(att => att.filename),
            timestamp: new Date().toISOString(),
          });
          
          dbAttachments.forEach(att => {
            finalAttachments.push({
              filename: att.filename,
              content: att.content,
              contentType: att.contentType,
            });
          });
        }
      } catch (dbError: any) {
        console.error('[Process Queue API] Error fetching attachments:', {
          itemId,
          error: dbError?.message,
          errorStack: dbError?.stack?.substring(0, 500),
          timestamp: new Date().toISOString(),
        });
        throw new Error(`Failed to fetch attachments: ${dbError?.message || 'Unknown error'}`);
      }
    }

    if (MOCK_EMAIL) {
      // Mock email sending
      console.log('[Process Queue API] Mock email mode:', {
        itemId,
        to,
        subject: subject?.substring(0, 50),
        attachmentsCount: finalAttachments.length,
        timestamp: new Date().toISOString(),
      });
      
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const mockResponse: ProcessQueueResponse = {
        success: true,
        messageId: `mock-${Date.now()}@${APP_MOCK_EMAIL_DOMAIN}`,
        mocked: true,
        itemId,
      };
      
      console.log('[Process Queue API] Mock email sent successfully:', {
        itemId,
        messageId: mockResponse.messageId,
        duration: Date.now() - requestStartTime,
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json(mockResponse);
    }

    // Real email sending
    console.log('[Process Queue API] Sending real email:', {
      itemId,
      to,
      subject: subject?.substring(0, 50),
      textLength: text?.length || 0,
      attachmentsCount: finalAttachments.length,
      attachmentFilenames: finalAttachments.map(att => att.filename),
      timestamp: new Date().toISOString(),
    });

    const result = await sendEmail({
      to,
      subject,
      text,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
    });

    console.log('[Process Queue API] Email sent successfully:', {
      itemId,
      messageId: result.messageId,
      duration: Date.now() - requestStartTime,
      timestamp: new Date().toISOString(),
    });

    const successResponse: ProcessQueueResponse = {
      success: true,
      messageId: result.messageId,
      itemId,
    };
    return NextResponse.json(successResponse);
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const duration = Date.now() - requestStartTime;
    
    console.error("[Process Queue API] Error sending email:", {
      itemId,
      errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorStack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
      duration,
      timestamp: new Date().toISOString(),
    });
    
    const errorResponse: ProcessQueueResponse = {
      success: false,
      error: errorMessage,
      itemId,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

