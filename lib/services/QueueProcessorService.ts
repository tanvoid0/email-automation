/**
 * Queue Processor Service
 * Handles email queue processing logic
 */

import {
  getQueue,
  getNextBatch,
  markBatchAsProcessing,
  updateQueueItemStatus,
  persistQueue,
  type EmailQueueItem,
  type QueueState,
} from "@/lib/utils/email-queue";
import { ApplicationStatusService } from "./ApplicationStatusService";
import type { ProcessQueueRequest, ProcessQueueResponse, ApiErrorResponse } from "@/lib/types/api";
import { getErrorMessage } from "@/lib/types/errors";

export interface ProcessEmailOptions {
  onProgress?: (item: EmailQueueItem, status: string) => void;
  signal?: AbortSignal;
}

export class QueueProcessorService {
  /**
   * Process a single email from the queue
   */
  static async processEmail(
    item: EmailQueueItem,
    index: number,
    options: ProcessEmailOptions = {}
  ): Promise<boolean> {
    const { onProgress, signal } = options;

    try {
      // Check if aborted
      if (signal?.aborted) {
        return false;
      }

      // Update status to processing
      updateQueueItemStatus(item.id, 'processing', undefined, 'Preparing email...');
      onProgress?.(item, 'processing');

      // Update queue state with current index
      const queueState = getQueue();
      queueState.currentItemIndex = index;
      persistQueue(queueState);

      // Update status to sending
      updateQueueItemStatus(item.id, 'sending', undefined, 'Sending email...');
      onProgress?.(item, 'sending');

      // Send email via API
      const requestBody: ProcessQueueRequest = {
        to: item.email,
        subject: item.subject,
        text: item.text,
        attachmentIds: item.attachmentIds.length > 0 ? item.attachmentIds : undefined,
        itemId: item.id,
      };

      // Log request details
      console.log('[QueueProcessorService] Sending email request:', {
        itemId: item.id,
        applicationId: item.applicationId,
        applicationName: item.applicationName,
        email: item.email,
        subject: item.subject?.substring(0, 50),
        textLength: item.text?.length || 0,
        attachmentIdsCount: item.attachmentIds.length,
        attachmentIds: item.attachmentIds,
        requestBodySize: JSON.stringify(requestBody).length,
        timestamp: new Date().toISOString(),
      });

      let response: Response;
      try {
        // Create a timeout (30 seconds)
        const timeoutMs = 30000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${timeoutMs}ms`));
          }, timeoutMs);
        });

        // Race between fetch and timeout
        response = await Promise.race([
          fetch('/api/email/process-queue', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal,
          }),
          timeoutPromise,
        ]) as Response;

        console.log('[QueueProcessorService] Fetch response received:', {
          itemId: item.id,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          timestamp: new Date().toISOString(),
        });
      } catch (fetchError: any) {
        console.error('[QueueProcessorService] Fetch error:', {
          itemId: item.id,
          applicationId: item.applicationId,
          errorName: fetchError?.name,
          errorMessage: fetchError?.message,
          errorStack: fetchError?.stack?.substring(0, 500),
          isAbortError: fetchError?.name === 'AbortError',
          signalAborted: signal?.aborted,
          timestamp: new Date().toISOString(),
        });
        
        // Provide more specific error messages
        if (fetchError?.name === 'AbortError') {
          throw new Error('Request was aborted');
        }
        if (fetchError?.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: Unable to reach server. Check your connection and server status. Original: ${fetchError.message}`);
        }
        throw fetchError;
      }

      if (!response.ok) {
        let errorData: ApiErrorResponse;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            errorData = await response.json();
          } else {
            const text = await response.text();
            errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
          }
        } catch (parseError: any) {
          console.error('[QueueProcessorService] Error parsing error response:', {
            itemId: item.id,
            status: response.status,
            statusText: response.statusText,
            parseError: parseError?.message,
          });
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText || 'Unknown error'}` 
          };
        }
        
        console.error('[QueueProcessorService] API error response:', {
          itemId: item.id,
          applicationId: item.applicationId,
          status: response.status,
          statusText: response.statusText,
          errorData,
          timestamp: new Date().toISOString(),
        });
        
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send email`);
      }

      let result: ProcessQueueResponse;
      try {
        result = await response.json();
        console.log('[QueueProcessorService] Email sent successfully:', {
          itemId: item.id,
          applicationId: item.applicationId,
          messageId: result.messageId,
          mocked: result.mocked,
          timestamp: new Date().toISOString(),
        });
      } catch (parseError: any) {
        console.error('[QueueProcessorService] Error parsing success response:', {
          itemId: item.id,
          status: response.status,
          parseError: parseError?.message,
        });
        throw new Error('Invalid response from server');
      }

      // Update status to sent
      updateQueueItemStatus(item.id, 'sent');
      onProgress?.(item, 'sent');

      // Update application status in database
      await ApplicationStatusService.markAsSent(item.applicationId);

      return true;
    } catch (error: unknown) {
      // Update status to error
      const errorMessage = getErrorMessage(error);
      
      console.error('[QueueProcessorService] Error processing email:', {
        itemId: item.id,
        applicationId: item.applicationId,
        applicationName: item.applicationName,
        email: item.email,
        errorMessage,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
        timestamp: new Date().toISOString(),
      });
      
      updateQueueItemStatus(item.id, 'error', errorMessage);
      onProgress?.(item, 'error');

      // Update application status in database
      await ApplicationStatusService.markAsError(item.applicationId, errorMessage).catch(
        (dbError: unknown) => {
          const dbErrorMessage = getErrorMessage(dbError);
          console.error('[QueueProcessorService] Failed to update application status:', {
            itemId: item.id,
            applicationId: item.applicationId,
            dbError: dbErrorMessage,
            timestamp: new Date().toISOString(),
          });
        }
      );

      return false;
    }
  }

  /**
   * Process a batch of emails
   */
  static async processBatch(
    batch: EmailQueueItem[],
    startIndex: number,
    options: ProcessEmailOptions = {}
  ): Promise<{ success: number; failed: number }> {
    console.log('[QueueProcessorService] Processing batch:', {
      batchSize: batch.length,
      startIndex,
      itemIds: batch.map(item => item.id),
      applicationIds: batch.map(item => item.applicationId),
      timestamp: new Date().toISOString(),
    });

    // Mark batch as processing
    markBatchAsProcessing(batch.map((item) => item.id));

    let success = 0;
    let failed = 0;

    // Process each email sequentially
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const globalIndex = startIndex + i;

      console.log('[QueueProcessorService] Processing email in batch:', {
        index: i + 1,
        total: batch.length,
        globalIndex: globalIndex + 1,
        itemId: item.id,
        applicationId: item.applicationId,
        applicationName: item.applicationName,
        email: item.email,
        timestamp: new Date().toISOString(),
      });

      // Check if aborted
      if (options.signal?.aborted) {
        console.warn('[QueueProcessorService] Batch processing aborted:', {
          itemId: item.id,
          index: i,
          timestamp: new Date().toISOString(),
        });
        // Reset items back to pending
        batch.forEach((batchItem) => {
          if (batchItem.status === 'processing') {
            updateQueueItemStatus(batchItem.id, 'pending');
          }
        });
        break;
      }

      const result = await this.processEmail(item, globalIndex, options);
      if (result) {
        success++;
        console.log('[QueueProcessorService] Email processed successfully:', {
          itemId: item.id,
          applicationId: item.applicationId,
          successCount: success,
          failedCount: failed,
          timestamp: new Date().toISOString(),
        });
      } else {
        failed++;
        console.warn('[QueueProcessorService] Email processing failed:', {
          itemId: item.id,
          applicationId: item.applicationId,
          successCount: success,
          failedCount: failed,
          timestamp: new Date().toISOString(),
        });
      }

      // Small delay between emails to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('[QueueProcessorService] Batch processing completed:', {
      batchSize: batch.length,
      success,
      failed,
      timestamp: new Date().toISOString(),
    });

    return { success, failed };
  }

  /**
   * Process all pending emails in the queue
   */
  static async processQueue(
    options: ProcessEmailOptions = {}
  ): Promise<{ totalProcessed: number; totalSuccess: number; totalFailed: number }> {
    const queueState = getQueue();
    const initialPending = queueState.items.filter(item => item.status === 'pending').length;
    
    console.log('[QueueProcessorService] Starting queue processing:', {
      totalItems: queueState.items.length,
      pendingItems: initialPending,
      isProcessing: queueState.isProcessing,
      currentItemIndex: queueState.currentItemIndex,
      timestamp: new Date().toISOString(),
    });

    queueState.isProcessing = true;
    persistQueue(queueState);

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    try {
      while (true) {
        // Check if aborted
        if (options.signal?.aborted) {
          console.warn('[QueueProcessorService] Queue processing aborted:', {
            totalProcessed,
            totalSuccess,
            totalFailed,
            timestamp: new Date().toISOString(),
          });
          break;
        }

        const batch = getNextBatch();
        if (batch.length === 0) {
          console.log('[QueueProcessorService] No more items to process:', {
            totalProcessed,
            totalSuccess,
            totalFailed,
            timestamp: new Date().toISOString(),
          });
          break;
        }

        const startIndex = queueState.items.findIndex(
          (item) => item.id === batch[0].id
        );

        console.log('[QueueProcessorService] Processing next batch:', {
          batchSize: batch.length,
          startIndex,
          totalProcessed,
          totalSuccess,
          totalFailed,
          timestamp: new Date().toISOString(),
        });

        const result = await this.processBatch(batch, startIndex, options);
        totalProcessed += batch.length;
        totalSuccess += result.success;
        totalFailed += result.failed;

        // Refresh queue to get updated state
        const updatedQueue = getQueue();
        queueState.items = updatedQueue.items;

        // Check if there are more items
        const pendingCount = queueState.items.filter(
          (item) => item.status === 'pending'
        ).length;
        
        console.log('[QueueProcessorService] Batch completed, checking for more:', {
          pendingCount,
          totalProcessed,
          totalSuccess,
          totalFailed,
          timestamp: new Date().toISOString(),
        });

        if (pendingCount === 0) {
          console.log('[QueueProcessorService] All items processed:', {
            totalProcessed,
            totalSuccess,
            totalFailed,
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('[QueueProcessorService] Fatal error in queue processing:', {
        errorMessage,
        totalProcessed,
        totalSuccess,
        totalFailed,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorStack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
        timestamp: new Date().toISOString(),
      });
      throw error;
    } finally {
      console.log('[QueueProcessorService] Queue processing finished:', {
        totalProcessed,
        totalSuccess,
        totalFailed,
        timestamp: new Date().toISOString(),
      });
      queueState.isProcessing = false;
      queueState.currentItemIndex = -1;
      persistQueue(queueState);
    }

    return {
      totalProcessed,
      totalSuccess,
      totalFailed,
    };
  }
}

