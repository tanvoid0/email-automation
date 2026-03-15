/**
 * Centralized timeout configuration
 * All timeout values in milliseconds
 */

export const TIMEOUT_CONFIG = {
  // Default timeout for HTTP requests (30 seconds)
  HTTP_REQUEST: 30000,
  
  // SMTP connection timeout (30 seconds)
  SMTP_CONNECTION: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || "30000"),
  
  // SMTP socket timeout (30 seconds)
  SMTP_SOCKET: parseInt(process.env.SMTP_SOCKET_TIMEOUT || "30000"),
  
  // SMTP greeting timeout (10 seconds)
  SMTP_GREETING: parseInt(process.env.SMTP_GREETING_TIMEOUT || "10000"),
  
  // SMTP test email timeout (60 seconds - longer for testing)
  SMTP_TEST: parseInt(process.env.SMTP_TEST_TIMEOUT || "60000"),
  
  // Email API request timeout (25 seconds)
  EMAIL_API_REQUEST: 25000,
  
  // Queue processor timeout
  // Increased to 5 minutes to align with server `maxDuration` for
  // /api/email/process-queue (which is 300s). Previously 30s caused
  // the client to time out while the server was still sending the
  // email successfully, leaving the UI in an error state.
  QUEUE_PROCESSOR: 300000,
} as const;

/**
 * Get timeout value by key
 */
export function getTimeout(key: keyof typeof TIMEOUT_CONFIG): number {
  return TIMEOUT_CONFIG[key];
}

