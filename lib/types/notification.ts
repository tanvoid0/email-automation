export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationMetadata {
  // For email operations
  applicationId?: string;
  emailAttemptedAt?: Date | string;
  emailSucceededAt?: Date | string;
  emailFailedAt?: Date | string;
  errorMessage?: string;
  
  // For bulk operations
  bulkId?: string;
  bulkType?: string;
  totalCount?: number;
  successCount?: number;
  failureCount?: number;
  groupedFailures?: Array<{
    error: string;
    count: number;
    applicationIds: string[];
    applicationNames: string[];
  }>;
  
  // For other operations
  [key: string]: any;
}

export interface NotificationData {
  _id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read?: boolean;
  readAt?: Date | string;
  metadata?: NotificationMetadata;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
}

export interface GroupedFailure {
  error: string;
  count: number;
  applicationIds: string[];
  applicationNames: string[];
}

