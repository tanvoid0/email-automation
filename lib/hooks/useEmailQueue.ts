"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getQueue,
  addToQueue as addToQueueStorage,
  clearQueue as clearQueueStorage,
  clearCompletedItems,
  restoreQueue,
  getQueueStats,
  getBatchSize,
  setBatchSize,
  persistQueue,
  type EmailQueueItem,
  type QueueState,
} from "@/lib/utils/email-queue";
import { QueueProcessorService } from "@/lib/services/QueueProcessorService";

export interface QueueProgress {
  currentIndex: number;
  total: number;
  currentItem?: EmailQueueItem;
  status: 'idle' | 'processing' | 'sending' | 'completed';
  message?: string;
  percentage: number;
}

export interface UseEmailQueueReturn {
  queue: QueueState;
  progress: QueueProgress;
  isProcessing: boolean;
  addToQueue: (items: Omit<EmailQueueItem, 'id' | 'status' | 'createdAt'>[]) => Promise<void>;
  pause: () => void;
  resume: () => void;
  clear: () => void;
  clearCompleted: () => void;
  batchSize: number;
  setBatchSize: (size: number) => void;
}

/**
 * Hook for managing email queue with batch processing and persistence
 */
export function useEmailQueue(): UseEmailQueueReturn {
  const [queue, setQueue] = useState<QueueState>(() => restoreQueue());
  const [progress, setProgress] = useState<QueueProgress>(() => {
    const stats = getQueueStats();
    return {
      currentIndex: 0,
      total: stats.total,
      status: 'idle',
      percentage: 0,
    };
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Update queue state from localStorage
  const refreshQueue = useCallback(() => {
    const updatedQueue = getQueue();
    setQueue(updatedQueue);
    
    const stats = getQueueStats();
    const currentItem = updatedQueue.items.find(item => 
      item.status === 'processing' || item.status === 'sending'
    );
    
    const completed = stats.sent + stats.error;
    const total = stats.total;
    
    setProgress({
      currentIndex: updatedQueue.currentItemIndex >= 0 ? updatedQueue.currentItemIndex + 1 : completed,
      total,
      currentItem,
      status: updatedQueue.isProcessing 
        ? (currentItem?.status === 'sending' ? 'sending' : 'processing')
        : stats.pending > 0 ? 'idle' : total > 0 ? 'completed' : 'idle',
      message: currentItem?.currentStatusMessage,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    });
    
    setIsProcessing(updatedQueue.isProcessing);
  }, []);

  // Process queue using service
  const processBatch = useCallback(async () => {
    if (processingRef.current) {
      console.log('[useEmailQueue] Processing already in progress, skipping:', {
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const queueState = getQueue();
    const stats = getQueueStats();
    
    console.log('[useEmailQueue] Starting queue processing:', {
      totalItems: queueState.items.length,
      pendingItems: stats.pending,
      sentItems: stats.sent,
      errorItems: stats.error,
      isProcessing: queueState.isProcessing,
      processingRef: processingRef.current,
      timestamp: new Date().toISOString(),
    });
    
    processingRef.current = true;
    refreshQueue();

    try {
      const result = await QueueProcessorService.processQueue({
        signal: abortControllerRef.current?.signal,
        onProgress: () => {
          refreshQueue();
        },
      });
      
      console.log('[useEmailQueue] Queue processing completed:', {
        totalProcessed: result.totalProcessed,
        totalSuccess: result.totalSuccess,
        totalFailed: result.totalFailed,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[useEmailQueue] Error processing queue:', {
        errorMessage: error?.message,
        errorName: error?.name,
        errorStack: error?.stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
      });
    } finally {
      processingRef.current = false;
      refreshQueue();
      
      const finalStats = getQueueStats();
      console.log('[useEmailQueue] Processing finished, final state:', {
        totalItems: getQueue().items.length,
        pendingItems: finalStats.pending,
        sentItems: finalStats.sent,
        errorItems: finalStats.error,
        timestamp: new Date().toISOString(),
      });
    }
  }, [refreshQueue]);

  // Auto-start processing if queue has pending items
  useEffect(() => {
    const stats = getQueueStats();
    const hasPending = stats.pending > 0;
    const queueState = getQueue();
    
    console.log('[useEmailQueue] Auto-start check:', {
      hasPending,
      isProcessing: queueState.isProcessing,
      processingRef: processingRef.current,
      pendingCount: stats.pending,
      totalItems: queueState.items.length,
      timestamp: new Date().toISOString(),
    });
    
    if (hasPending && !queueState.isProcessing && !processingRef.current) {
      console.log('[useEmailQueue] Auto-starting queue processing:', {
        pendingCount: stats.pending,
        timestamp: new Date().toISOString(),
      });
      // Auto-resume processing
      processBatch();
    }
  }, [queue.items.length, processBatch]);

  // Refresh queue periodically
  useEffect(() => {
    const interval = setInterval(() => {
      refreshQueue();
    }, 1000); // Refresh every second
    
    return () => clearInterval(interval);
  }, [refreshQueue]);

  // Initial load
  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const handleAddToQueue = useCallback(async (
    items: Omit<EmailQueueItem, 'id' | 'status' | 'createdAt'>[]
  ) => {
    addToQueueStorage(items);
    refreshQueue();
    
    // Auto-start processing if not already processing
    if (!processingRef.current) {
      await processBatch();
    }
  }, [refreshQueue, processBatch]);

  const pause = useCallback(() => {
    console.log('[useEmailQueue] Pausing queue processing:', {
      timestamp: new Date().toISOString(),
    });
    
    // Abort current processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    processingRef.current = false;
    const queueState = getQueue();
    queueState.isProcessing = false;
    persistQueue(queueState);
    refreshQueue();
  }, [refreshQueue]);

  const resume = useCallback(async () => {
    const stats = getQueueStats();
    console.log('[useEmailQueue] Resuming queue processing:', {
      pendingCount: stats.pending,
      timestamp: new Date().toISOString(),
    });
    
    // Create new abort controller for resumed processing
    abortControllerRef.current = new AbortController();
    await processBatch();
  }, [processBatch]);

  const clear = useCallback(() => {
    pause(); // Stop processing first
    clearQueueStorage();
    refreshQueue();
  }, [pause, refreshQueue]);

  const handleClearCompleted = useCallback(() => {
    clearCompletedItems();
    refreshQueue();
  }, [refreshQueue]);

  const handleSetBatchSize = useCallback((size: number) => {
    setBatchSize(size);
    const updatedQueue = getQueue();
    updatedQueue.batchSize = size;
    persistQueue(updatedQueue);
    setQueue(updatedQueue);
  }, []);

  return {
    queue,
    progress,
    isProcessing,
    addToQueue: handleAddToQueue,
    pause,
    resume,
    clear,
    clearCompleted: handleClearCompleted,
    batchSize: getBatchSize(),
    setBatchSize: handleSetBatchSize,
  };
}
