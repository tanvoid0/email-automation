/**
 * Error types
 * Shared between UI components and services
 */

/**
 * Standard error with message
 */
export interface StandardError {
  message: string;
  name?: string;
  stack?: string;
}

/**
 * HTTP error response
 */
export interface HttpErrorResponse {
  status: number;
  statusText: string;
  error: string;
  message?: string;
}

/**
 * Type guard to check if error is StandardError
 */
export function isStandardError(error: unknown): error is StandardError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as StandardError).message === 'string'
  );
}

/**
 * Extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isStandardError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

