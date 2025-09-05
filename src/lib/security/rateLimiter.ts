import type { RateLimitResult, SecurityValidationResult } from "./types";
import { getSecurityConfig } from "./config";
import { SecurityErrors } from "./errors";

interface RateLimitEntry {
  requests: number[];
  resetTime: number;
}

interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (identifier: string) => string;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private options: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions = {}) {
    const config = getSecurityConfig();
    
    this.options = {
      maxRequests: options.maxRequests ?? config.rateLimiting.maxRequests,
      windowMs: options.windowMs ?? config.rateLimiting.windowMs,
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? config.rateLimiting.skipSuccessfulRequests ?? false,
      keyGenerator: options.keyGenerator ?? ((id: string) => `rate_limit:${id}`),
    };

    // Clean up expired entries periodically
    this.startCleanupInterval();
  }

  /**
   * Check if a request should be rate limited
   */
  checkLimit(identifier: string): RateLimitResult {
    const key = this.options.keyGenerator(identifier);
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Get or create entry for this identifier
    let entry = this.store.get(key);
    if (!entry) {
      entry = {
        requests: [],
        resetTime: now + this.options.windowMs,
      };
      this.store.set(key, entry);
    }

    // Remove requests outside the current window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    
    // Update reset time if needed
    if (entry.resetTime <= now) {
      entry.resetTime = now + this.options.windowMs;
    }

    const currentRequestCount = entry.requests.length;
    const remaining = Math.max(0, this.options.maxRequests - currentRequestCount);

    // Check if limit is exceeded
    if (currentRequestCount >= this.options.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        error: SecurityErrors.RATE_LIMITED(remaining, entry.resetTime),
      };
    }

    // Add current request timestamp
    entry.requests.push(now);

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      resetTime: entry.resetTime,
    };
  }

  /**
   * Record a successful request (if skipSuccessfulRequests is true)
   */
  recordSuccess(identifier: string): void {
    if (!this.options.skipSuccessfulRequests) {
      return;
    }

    const key = this.options.keyGenerator(identifier);
    const entry = this.store.get(key);
    
    if (entry && entry.requests.length > 0) {
      // Remove the last request from the count since it was successful
      entry.requests.pop();
    }
  }

  /**
   * Get current rate limit status for an identifier
   */
  getStatus(identifier: string): { requests: number; remaining: number; resetTime: number } {
    const key = this.options.keyGenerator(identifier);
    const entry = this.store.get(key);
    
    if (!entry) {
      return {
        requests: 0,
        remaining: this.options.maxRequests,
        resetTime: Date.now() + this.options.windowMs,
      };
    }

    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    const validRequests = entry.requests.filter(timestamp => timestamp > windowStart);

    return {
      requests: validRequests.length,
      remaining: Math.max(0, this.options.maxRequests - validRequests.length),
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  reset(identifier: string): void {
    const key = this.options.keyGenerator(identifier);
    this.store.delete(key);
  }

  /**
   * Get statistics about the rate limiter
   */
  getStats(): { totalKeys: number; activeKeys: number; totalRequests: number } {
    const now = Date.now();
    let activeKeys = 0;
    let totalRequests = 0;

    for (const entry of this.store.values()) {
      const windowStart = now - this.options.windowMs;
      const activeRequestsInWindow = entry.requests.filter(timestamp => timestamp > windowStart);
      
      if (activeRequestsInWindow.length > 0) {
        activeKeys++;
      }
      
      totalRequests += activeRequestsInWindow.length;
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
      totalRequests,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      const windowStart = now - this.options.windowMs;
      entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
      
      // Remove entries with no recent requests and expired reset time
      if (entry.requests.length === 0 && entry.resetTime <= now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.store.delete(key));
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
}

// Global rate limiter instances
const globalRateLimiter = new RateLimiter();

// Specialized rate limiters for different endpoints
const streamingRateLimiter = new RateLimiter({
  maxRequests: 3, // More restrictive for expensive streaming operations
  windowMs: 10 * 60 * 1000, // 10 minutes
  keyGenerator: (id: string) => `streaming_rate_limit:${id}`,
});

/**
 * Validate rate limit for a user/session
 */
export function validateRateLimit(
  identifier: string, 
  limiterType: 'global' | 'streaming' = 'global'
): SecurityValidationResult {
  const limiter = limiterType === 'streaming' ? streamingRateLimiter : globalRateLimiter;
  const result = limiter.checkLimit(identifier);

  if (!result.allowed) {
    return {
      success: false,
      error: result.error,
    };
  }

  return {
    success: true,
    userId: identifier,
  };
}

/**
 * Record a successful request (for skipSuccessfulRequests feature)
 */
export function recordSuccessfulRequest(
  identifier: string, 
  limiterType: 'global' | 'streaming' = 'global'
): void {
  const limiter = limiterType === 'streaming' ? streamingRateLimiter : globalRateLimiter;
  limiter.recordSuccess(identifier);
}

/**
 * Get rate limit status for monitoring
 */
export function getRateLimitStatus(
  identifier: string, 
  limiterType: 'global' | 'streaming' = 'global'
) {
  const limiter = limiterType === 'streaming' ? streamingRateLimiter : globalRateLimiter;
  return limiter.getStatus(identifier);
}

/**
 * Reset rate limits for a user (admin function)
 */
export function resetRateLimit(
  identifier: string, 
  limiterType: 'global' | 'streaming' = 'global'
): void {
  const limiter = limiterType === 'streaming' ? streamingRateLimiter : globalRateLimiter;
  limiter.reset(identifier);
}

/**
 * Get overall rate limiter statistics
 */
export function getRateLimiterStats() {
  return {
    global: globalRateLimiter.getStats(),
    streaming: streamingRateLimiter.getStats(),
  };
}

export { RateLimiter };