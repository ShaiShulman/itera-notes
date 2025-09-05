export interface SecurityValidationResult {
  success: boolean;
  error?: SecurityError;
  userId?: string;
  sessionId?: string;
}

export interface SecurityError {
  type: "UNAUTHORIZED" | "FORBIDDEN" | "RATE_LIMITED" | "CSRF_INVALID" | "ORIGIN_INVALID" | "VALIDATION_ERROR";
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: SecurityError;
}

export interface CSRFTokenData {
  token: string;
  expiresAt: number;
  sessionId: string;
}

export interface SecurityConfig {
  rateLimiting: {
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests?: boolean;
  };
  csrf: {
    tokenExpiryMs: number;
    secretKey: string;
  };
  origins: {
    allowedDomains: string[];
    allowLocalhost: boolean;
  };
  authentication: {
    required: boolean;
    redirectOnFailure?: string;
  };
}

export interface ApiSecurityOptions {
  requireAuth?: boolean;
  requireCSRF?: boolean;
  rateLimit?: boolean;
  checkOrigin?: boolean;
  customValidation?: (request: Request) => Promise<SecurityValidationResult>;
}