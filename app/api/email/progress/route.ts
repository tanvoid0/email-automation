import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "edge"; // Use edge runtime for SSE

/**
 * Server-Sent Events endpoint for real-time email queue progress
 */
export async function GET(request: NextRequest) {
  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial connection message
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
      );

      // Poll queue state and send updates
      const interval = setInterval(async () => {
        try {
          // In a real implementation, you'd read from a shared state or database
          // For now, we'll use a simple approach where the client sends queue state
          // In production, you might want to use Redis or a database for shared state
          
          // Send heartbeat to keep connection alive
          controller.enqueue(
            encoder.encode(`: heartbeat\n\n`)
          );
        } catch (error) {
          console.error('[SSE] Error sending update:', error);
        }
      }, 1000); // Send updates every second

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for nginx
    },
  });
}

