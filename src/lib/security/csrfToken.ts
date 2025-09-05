import { createHash, randomBytes } from "crypto";
import type { CSRFTokenData, SecurityValidationResult } from "./types";
import { getSecurityConfig } from "./config";
import { SecurityErrors } from "./errors";

// In-memory token store (in production, consider using Redis or database)
const tokenStore = new Map<string, CSRFTokenData>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, tokenData] of tokenStore.entries()) {
    if (tokenData.expiresAt < now) {
      tokenStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Generate a secure CSRF token for a user session
 */
export function generateCSRFToken(sessionId: string): string {
  const config = getSecurityConfig();
  const now = Date.now();
  const expiresAt = now + config.csrf.tokenExpiryMs;
  
  // Generate a cryptographically secure random token
  const randomToken = randomBytes(32).toString('hex');
  
  // Create a hash that includes session ID and secret for additional security
  const tokenHash = createHash('sha256')
    .update(`${randomToken}:${sessionId}:${config.csrf.secretKey}`)
    .digest('hex');
  
  const finalToken = `${randomToken}.${tokenHash.substring(0, 16)}`;
  
  // Store token data
  const tokenData: CSRFTokenData = {
    token: finalToken,
    expiresAt,
    sessionId,
  };
  
  tokenStore.set(finalToken, tokenData);
  
  return finalToken;
}

/**
 * Validate a CSRF token against the stored tokens
 */
export function validateCSRFToken(token: string, sessionId: string): SecurityValidationResult {
  if (!token || !sessionId) {
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  const tokenData = tokenStore.get(token);
  
  if (!tokenData) {
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  // Check if token has expired
  if (tokenData.expiresAt < Date.now()) {
    tokenStore.delete(token);
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  // Check if token belongs to the correct session
  if (tokenData.sessionId !== sessionId) {
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  // Verify token integrity
  const config = getSecurityConfig();
  const [randomPart, hashPart] = token.split('.');
  
  if (!randomPart || !hashPart) {
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  const expectedHash = createHash('sha256')
    .update(`${randomPart}:${sessionId}:${config.csrf.secretKey}`)
    .digest('hex')
    .substring(0, 16);

  if (hashPart !== expectedHash) {
    return {
      success: false,
      error: SecurityErrors.CSRF_INVALID,
    };
  }

  return {
    success: true,
    sessionId: tokenData.sessionId,
  };
}

/**
 * Extract CSRF token from request headers or body
 */
export function extractCSRFToken(request: Request): string | null {
  // Check X-CSRF-Token header first
  const headerToken = request.headers.get('X-CSRF-Token');
  if (headerToken) {
    return headerToken;
  }

  // Check if it's in the request body (for form data)
  // Note: This requires the request body to be parsed elsewhere
  return null;
}

/**
 * Remove expired tokens and clean up memory
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [key, tokenData] of tokenStore.entries()) {
    if (tokenData.expiresAt < now) {
      tokenStore.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired CSRF tokens`);
  }
}

/**
 * Get token statistics for monitoring
 */
export function getTokenStats() {
  const now = Date.now();
  let activeTokens = 0;
  let expiredTokens = 0;
  
  for (const tokenData of tokenStore.values()) {
    if (tokenData.expiresAt > now) {
      activeTokens++;
    } else {
      expiredTokens++;
    }
  }
  
  return {
    total: tokenStore.size,
    active: activeTokens,
    expired: expiredTokens,
  };
}