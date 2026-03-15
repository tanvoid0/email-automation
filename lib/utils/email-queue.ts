/**
 * Email Queue Manager
 * Manages persistent email queue in localStorage with batch processing
 */

export interface EmailQueueItem {
  id: string;
  applicationId: string;
  applicationName: string;
  email: string;
  subject: string;
  text: string;
  attachmentIds: string[];
  status: 'pending' | 'processing' | 'sending' | 'sent' | 'error';
  error?: string;
  createdAt: string;
  processedAt?: string;
  currentStatusMessage?: string; // e.g., "Processing attachments...", "Sending..."
}

export interface QueueState {
  items: EmailQueueItem[];
  currentBatch: number;
  batchSize: number;
  isProcessing: boolean;
  totalProcessed: number;
  totalFailed: number;
  currentItemIndex: number; // Index of currently processing item
}

const QUEUE_STORAGE_KEY = 'email-queue';
const QUEUE_VERSION = 1; // For future migrations

/**
 * Get default queue state
 */
function getDefaultQueueState(batchSize: number = 10): QueueState {
  return {
    items: [],
    currentBatch: 0,
    batchSize,
    isProcessing: false,
    totalProcessed: 0,
    totalFailed: 0,
    currentItemIndex: -1,
  };
}

/**
 * Get batch size from settings (localStorage or default)
 */
export function getBatchSize(): number {
  if (typeof window === 'undefined') return 10;
  
  try {
    const stored = localStorage.getItem('email-batch-size');
    if (stored) {
      const size = parseInt(stored, 10);
      if (!isNaN(size) && size > 0 && size <= 50) {
        return size;
      }
    }
  } catch (error) {
    console.warn('[EmailQueue] Failed to read batch size from localStorage:', error);
  }
  
  return 10; // Default
}

/**
 * Save batch size to localStorage
 */
export function setBatchSize(size: number): void {
  if (typeof window === 'undefined') return;
  
  try {
    const validSize = Math.max(1, Math.min(50, size));
    localStorage.setItem('email-batch-size', validSize.toString());
  } catch (error) {
    console.warn('[EmailQueue] Failed to save batch size to localStorage:', error);
  }
}

/**
 * Get current queue state from localStorage
 */
export function getQueue(): QueueState {
  if (typeof window === 'undefined') {
    return getDefaultQueueState();
  }
  
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old format if needed
      if (parsed.version !== QUEUE_VERSION) {
        // Handle migration if needed in future
      }
      
      // Ensure batch size is current
      const batchSize = getBatchSize();
      const q = {
        ...parsed,
        batchSize,
      };
      // lightweight trace
      // Note: avoid logging entire queue items to keep console readable
      console.debug('[EmailQueue] getQueue restored from storage:', {
        itemsCount: q.items?.length ?? 0,
        batchSize: q.batchSize,
        currentBatch: q.currentBatch,
        isProcessing: q.isProcessing,
        currentItemIndex: q.currentItemIndex,
        timestamp: new Date().toISOString(),
      });
      return q;
    }
  } catch (error) {
    console.warn('[EmailQueue] Failed to read queue from localStorage:', error);
  }
  
  return getDefaultQueueState(getBatchSize());
}

/**
 * Save queue state to localStorage
 */
export function persistQueue(queue: QueueState): void {
  if (typeof window === 'undefined') return;
  
  try {
    const toStore = {
      ...queue,
      version: QUEUE_VERSION,
    };
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('[EmailQueue] Failed to save queue to localStorage:', error);
    // If quota exceeded, try to clean up old completed items
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      cleanupCompletedItems();
      // Retry once
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({
          ...queue,
          version: QUEUE_VERSION,
        }));
      } catch (retryError) {
        console.error('[EmailQueue] Failed to save queue after cleanup:', retryError);
      }
    }
  }
}

/**
 * Add items to queue
 */
export function addToQueue(items: Omit<EmailQueueItem, 'id' | 'status' | 'createdAt'>[]): EmailQueueItem[] {
  const queue = getQueue();
  const batchSize = getBatchSize();
  
  const newItems: EmailQueueItem[] = items.map(item => ({
    ...item,
    id: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
  }));
  
  queue.items = [...queue.items, ...newItems];
  queue.batchSize = batchSize;
  
  persistQueue(queue);
  
  return newItems;
}

/**
 * Update item status in queue
 */
export function updateQueueItemStatus(
  itemId: string,
  status: EmailQueueItem['status'],
  error?: string,
  statusMessage?: string
): void {
  const queue = getQueue();
  const item = queue.items.find(i => i.id === itemId);
  
  if (item) {
    const prev = { 
      status: item.status, 
      error: item.error, 
      currentStatusMessage: item.currentStatusMessage,
      processedAt: item.processedAt,
    };

    console.log('[EmailQueue] updateQueueItemStatus called:', {
      itemId,
      fromStatus: item.status,
      toStatus: status,
      incomingError: error,
      incomingStatusMessage: statusMessage,
      timestamp: new Date().toISOString(),
    });

    item.status = status;
    // Error handling semantics:
    // - If caller provides `error` (even empty string), set it explicitly.
    // - If no error provided and status is not 'error', clear any previous error.
    if (error !== undefined) {
      item.error = error || undefined;
    } else if (status !== 'error') {
      item.error = undefined;
    }
    // Status message semantics:
    // - Only update when caller provides a value (including empty string to clear).
    if (statusMessage !== undefined) {
      item.currentStatusMessage = statusMessage || undefined;
    }
    if (status === 'sent' || status === 'error') {
      item.processedAt = new Date().toISOString();
    }
    
    persistQueue(queue);

    console.log('[EmailQueue] updateQueueItemStatus persisted:', {
      itemId,
      prev,
      next: {
        status: item.status,
        error: item.error,
        currentStatusMessage: item.currentStatusMessage,
        processedAt: item.processedAt,
      },
      queueCurrentItemIndex: queue.currentItemIndex,
      timestamp: new Date().toISOString(),
    });
  }
  else {
    console.warn('[EmailQueue] updateQueueItemStatus: item not found in queue', {
      itemId,
      desiredStatus: status,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get next batch of items to process
 */
export function getNextBatch(): EmailQueueItem[] {
  const queue = getQueue();
  const pending = queue.items.filter(item => item.status === 'pending');
  
  if (pending.length === 0) {
    return [];
  }
  
  const batch = pending.slice(0, queue.batchSize);
  return batch;
}

/**
 * Mark batch as processing
 */
export function markBatchAsProcessing(itemIds: string[]): void {
  const queue = getQueue();
  const beforeStatuses = queue.items
    .filter(item => itemIds.includes(item.id))
    .map(item => ({ id: item.id, prevStatus: item.status }));
  
  queue.items = queue.items.map(item => {
    if (itemIds.includes(item.id)) {
      return { ...item, status: 'processing' as const };
    }
    return item;
  });
  
  queue.isProcessing = true;
  persistQueue(queue);

  console.log('[EmailQueue] markBatchAsProcessing:', {
    itemIds,
    count: itemIds.length,
    beforeStatuses,
    afterStatuses: queue.items
      .filter(item => itemIds.includes(item.id))
      .map(item => ({ id: item.id, status: item.status })),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Clear completed items older than 24 hours
 */
export function cleanupCompletedItems(): void {
  const queue = getQueue();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  queue.items = queue.items.filter(item => {
    if (item.status === 'sent' || item.status === 'error') {
      if (item.processedAt) {
        const processedTime = new Date(item.processedAt).getTime();
        return (now - processedTime) < twentyFourHours;
      }
    }
    return true; // Keep pending/processing items
  });
  
  persistQueue(queue);

  console.log('[EmailQueue] cleanupCompletedItems executed:', {
    remainingItems: queue.items.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Clear all completed items
 */
export function clearCompletedItems(): void {
  const queue = getQueue();
  
  queue.items = queue.items.filter(item => 
    item.status !== 'sent' && item.status !== 'error'
  );
  
  persistQueue(queue);
}

/**
 * Remove queue items by application ID
 */
export function removeQueueItemsByApplicationId(applicationId: string): void {
  const queue = getQueue();
  
  queue.items = queue.items.filter(item => item.applicationId !== applicationId);
  
  persistQueue(queue);
}

/**
 * Clear entire queue
 */
export function clearQueue(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (error) {
    console.error('[EmailQueue] Failed to clear queue:', error);
  }
}

/**
 * Restore queue from localStorage (called on page load)
 */
export function restoreQueue(): QueueState {
  const queue = getQueue();
  
  // Clean up old completed items
  cleanupCompletedItems();
  
  // Reset processing state if page was reloaded
  if (queue.isProcessing) {
    // Check if any items are actually processing (might have been interrupted)
    const hasProcessing = queue.items.some(item => 
      item.status === 'processing' || item.status === 'sending'
    );
    
    if (!hasProcessing) {
      // Reset processing state - queue was interrupted
      queue.isProcessing = false;
      // Reset processing items back to pending
      queue.items = queue.items.map(item => {
        if (item.status === 'processing' || item.status === 'sending') {
          return { ...item, status: 'pending' as const };
        }
        return item;
      });
      persistQueue(queue);
    }
  }
  
  return queue;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  error: number;
  completed: number;
} {
  const queue = getQueue();
  
  return {
    total: queue.items.length,
    pending: queue.items.filter(i => i.status === 'pending').length,
    processing: queue.items.filter(i => i.status === 'processing' || i.status === 'sending').length,
    sent: queue.items.filter(i => i.status === 'sent').length,
    error: queue.items.filter(i => i.status === 'error').length,
    completed: queue.items.filter(i => i.status === 'sent' || i.status === 'error').length,
  };
}

