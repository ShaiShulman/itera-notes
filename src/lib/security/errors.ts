import type { SecurityError } from "./types";

export function createSecurityError(
  type: SecurityError["type"], 
  message: string, 
  details?: Record<string, any>
): SecurityError {
  const statusCodeMap = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    RATE_LIMITED: 429,
    CSRF_INVALID: 403,
    ORIGIN_INVALID: 403,
    VALIDATION_ERROR: 400,
  };

  return {
    type,
    message,
    statusCode: statusCodeMap[type],
    details,
  };
}

export function createSecurityResponse(error: SecurityError): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        type: error.type,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
    }),
    {
      status: error.statusCode,
      headers: {
        "Content-Type": "application/json",
        // Security headers
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
      },
    }
  );
}

// Pre-defined common errors
export const SecurityErrors = {
  UNAUTHORIZED: createSecurityError(
    "UNAUTHORIZED",
    "Authentication required. Please log in to access this resource."
  ),
  
  RATE_LIMITED: (remaining: number, resetTime: number) => createSecurityError(
    "RATE_LIMITED",
    `Too many requests. Please try again later.`,
    { remaining, resetTime }
  ),
  
  CSRF_INVALID: createSecurityError(
    "CSRF_INVALID", 
    "Invalid or missing CSRF token. Please refresh the page and try again."
  ),
  
  ORIGIN_INVALID: createSecurityError(
    "ORIGIN_INVALID",
    "Request not allowed from this origin."
  ),
  
  FORBIDDEN: createSecurityError(
    "FORBIDDEN",
    "Access denied. You don't have permission to access this resource."
  ),
  
  VALIDATION_ERROR: (details: Record<string, any>) => createSecurityError(
    "VALIDATION_ERROR",
    "Request validation failed.",
    details
  ),
} as const;