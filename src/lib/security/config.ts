import type { SecurityConfig } from "./types";

const isDevelopment = process.env.NODE_ENV === "development";

export const defaultSecurityConfig: SecurityConfig = {
  rateLimiting: {
    maxRequests: isDevelopment ? 20 : 5, // More lenient in development
    windowMs: 10 * 60 * 1000, // 10 minutes
    skipSuccessfulRequests: false,
  },
  csrf: {
    tokenExpiryMs: 30 * 60 * 1000, // 30 minutes
    secretKey: process.env.CSRF_SECRET_KEY || "default-csrf-secret-change-in-production",
  },
  origins: {
    allowedDomains: [
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "https://your-production-domain.com", // Replace with actual domain
    ],
    allowLocalhost: isDevelopment,
  },
  authentication: {
    required: true,
    redirectOnFailure: "/auth/signin",
  },
};

export function getSecurityConfig(): SecurityConfig {
  return {
    ...defaultSecurityConfig,
    // Override with environment variables if available
    rateLimiting: {
      ...defaultSecurityConfig.rateLimiting,
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS 
        ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) 
        : defaultSecurityConfig.rateLimiting.maxRequests,
      windowMs: process.env.RATE_LIMIT_WINDOW_MS 
        ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) 
        : defaultSecurityConfig.rateLimiting.windowMs,
    },
    csrf: {
      ...defaultSecurityConfig.csrf,
      secretKey: process.env.CSRF_SECRET_KEY || defaultSecurityConfig.csrf.secretKey,
    },
  };
}