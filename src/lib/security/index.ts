// Main security API
export {
  validateApiRequest,
  withApiSecurity,
  withBasicSecurity,
  withMaximumSecurity,
} from "./apiProtection";

// Authentication
export {
  validateAuthentication,
  validateOrigin,
} from "./authentication";

// CSRF protection
export {
  generateCSRFToken,
  validateCSRFToken,
  extractCSRFToken,
  cleanupExpiredTokens,
  getTokenStats,
} from "./csrfToken";

// Rate limiting
export {
  validateRateLimit,
  recordSuccessfulRequest,
  getRateLimitStatus,
  resetRateLimit,
  getRateLimiterStats,
  RateLimiter,
} from "./rateLimiter";

// Configuration
export {
  getSecurityConfig,
  defaultSecurityConfig,
} from "./config";

// Error handling
export {
  createSecurityError,
  createSecurityResponse,
  SecurityErrors,
} from "./errors";

// Types
export type {
  SecurityValidationResult,
  SecurityError,
  RateLimitResult,
  CSRFTokenData,
  SecurityConfig,
  ApiSecurityOptions,
} from "./types";