/**
 * Application Status Service
 * Handles application status updates in the database
 */

import type { ApplicationStatus, ErrorDetails } from "@/lib/types/application";
import { getErrorMessage } from "@/lib/types/errors";

export interface StatusUpdateOptions {
  error?: string | null;
  errorDetails?: ErrorDetails | null;
  attemptId?: string; // for concurrency / stale-attempt protection
  expectedVersion?: number; // optimistic concurrency
}

export class ApplicationStatusService {
  /**
   * Update application status in the database
   */
  static async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    options: StatusUpdateOptions = {}
  ): Promise<void> {
    try {
      // Build update body - explicitly set null to clear fields, undefined to omit
      const updateBody: any = { status };
      if (options.error !== undefined) {
        updateBody.error = options.error; // Can be string, null, or undefined
      }
      if (options.errorDetails !== undefined) {
        updateBody.errorDetails = options.errorDetails; // Can be ErrorDetails, null, or undefined
      }
      if (options.attemptId !== undefined) {
        updateBody.attemptId = options.attemptId;
      }
      if (options.expectedVersion !== undefined) {
        updateBody.expectedVersion = options.expectedVersion;
      }

      console.log('[ApplicationStatusService] updateStatus starting:', {
        applicationId,
        toStatus: status,
        includeError: options.error !== undefined,
        errorPreview: typeof options.error === 'string' ? options.error?.substring(0, 120) : options.error,
        includeErrorDetails: options.errorDetails !== undefined,
        attemptId: options.attemptId,
        expectedVersion: options.expectedVersion,
        timestamp: new Date().toISOString(),
      });

      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });

      if (!response.ok) {
        if (response.status === 409) {
          let text: string | undefined;
          try { text = await response.text(); } catch {}
          console.warn('[ApplicationStatusService] updateStatus conflict (likely stale attempt):', {
            applicationId,
            toStatus: status,
            httpStatus: response.status,
            responseText: text,
            attemptId: options.attemptId,
            timestamp: new Date().toISOString(),
          });
          throw new Error('STALE_ATTEMPT');
        }
        let responseText: string | undefined;
        try {
          responseText = await response.text();
        } catch {}
        console.error('[ApplicationStatusService] updateStatus response not OK:', {
          applicationId,
          toStatus: status,
          httpStatus: response.status,
          statusText: response.statusText,
          responseText,
          timestamp: new Date().toISOString(),
        });
        throw new Error(`Failed to update application status (HTTP ${response.status} ${response.statusText})`);
      }

      console.log('[ApplicationStatusService] updateStatus success:', {
        applicationId,
        toStatus: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("[ApplicationStatusService] Error updating status:", {
        applicationId,
        toStatus: status,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Update multiple application statuses
   */
  static async updateMultipleStatuses(
    applicationIds: string[],
    status: ApplicationStatus,
    options: StatusUpdateOptions = {}
  ): Promise<void> {
    // Update in parallel for better performance
    await Promise.all(
      applicationIds.map((id) =>
        this.updateStatus(id, status, options).catch((error: unknown) => {
          const errorMessage = getErrorMessage(error);
          console.error(`[ApplicationStatusService] Failed to update ${id}:`, errorMessage);
        })
      )
    );
  }

  /**
   * Mark application as sending
   */
  static async markAsSending(
    applicationId: string,
    opts?: Pick<StatusUpdateOptions, 'attemptId' | 'expectedVersion'>
  ): Promise<void> {
    // Clear any previous error when we attempt to resend
    return this.updateStatus(applicationId, "sending", {
      error: null,
      errorDetails: null,
      attemptId: opts?.attemptId,
      expectedVersion: opts?.expectedVersion,
    });
  }

  /**
   * Mark application as sent
   * Clears any previous error messages
   */
  static async markAsSent(
    applicationId: string,
    opts?: Pick<StatusUpdateOptions, 'attemptId' | 'expectedVersion'>
  ): Promise<void> {
    return this.updateStatus(applicationId, "sent", {
      error: null,
      errorDetails: null,
      attemptId: opts?.attemptId,
      expectedVersion: opts?.expectedVersion,
    });
  }

  /**
   * Mark application as error
   */
  static async markAsError(
    applicationId: string,
    error: string,
    errorDetails?: ErrorDetails,
    opts?: Pick<StatusUpdateOptions, 'attemptId' | 'expectedVersion'>
  ): Promise<void> {
    return this.updateStatus(applicationId, "error", { 
      error, 
      errorDetails,
      attemptId: opts?.attemptId,
      expectedVersion: opts?.expectedVersion,
    });
  }

  /**
   * Mark application as cancelled
   * Clears any previous error messages
   */
  static async markAsCancelled(applicationId: string): Promise<void> {
    return this.updateStatus(applicationId, "cancelled", {
      error: null,
      errorDetails: null,
    });
  }

  /**
   * Cancel all stuck applications (status: "sending")
   */
  static async cancelStuckApplications(): Promise<number> {
    try {
      const response = await fetch("/api/applications/cancel-stuck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to cancel stuck applications");
      }

      const result = await response.json();
      return result.cancelledCount || 0;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("[ApplicationStatusService] Error cancelling stuck applications:", errorMessage);
      throw error;
    }
  }
}

