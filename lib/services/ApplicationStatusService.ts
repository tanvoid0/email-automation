/**
 * Application Status Service
 * Handles application status updates in the database
 */

import type { ApplicationStatus, ErrorDetails } from "@/lib/types/application";
import { getErrorMessage } from "@/lib/types/errors";

export interface StatusUpdateOptions {
  error?: string | null;
  errorDetails?: ErrorDetails | null;
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

      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateBody),
      });

      if (!response.ok) {
        throw new Error("Failed to update application status");
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error("[ApplicationStatusService] Error updating status:", errorMessage);
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
  static async markAsSending(applicationId: string): Promise<void> {
    return this.updateStatus(applicationId, "sending");
  }

  /**
   * Mark application as sent
   * Clears any previous error messages
   */
  static async markAsSent(applicationId: string): Promise<void> {
    return this.updateStatus(applicationId, "sent", {
      error: null,
      errorDetails: null,
    });
  }

  /**
   * Mark application as error
   */
  static async markAsError(
    applicationId: string,
    error: string,
    errorDetails?: ErrorDetails
  ): Promise<void> {
    return this.updateStatus(applicationId, "error", { error, errorDetails });
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

