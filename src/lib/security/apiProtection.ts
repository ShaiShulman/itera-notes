import { NextRequest } from "next/server";
import type { SecurityValidationResult, ApiSecurityOptions } from "./types";
import { validateAuthentication, validateOrigin } from "./authentication";
import { validateCSRFToken, extractCSRFToken } from "./csrfToken";
import { validateRateLimit, recordSuccessfulRequest } from "./rateLimiter";
import { createSecurityResponse } from "./errors";

/**
 * Comprehensive API security validation
 * Runs all configured security checks in the correct order
 */
export async function validateApiRequest(
  request: NextRequest,
  options: ApiSecurityOptions = {}
): Promise<SecurityValidationResult> {
  const {
    requireAuth = true,
    requireCSRF = true,
    rateLimit = true,
    checkOrigin = true,
    customValidation,
  } = options;

  let userId: string | undefined;
  let sessionId: string | undefined;

  console.log(`🔒 Starting security validation for ${request.method} ${request.url}`);

  // Step 1: Authentication (if required)
  if (requireAuth) {
    console.log("🔐 Validating authentication...");
    const authResult = await validateAuthentication();
    
    if (!authResult.success) {
      console.log("❌ Authentication failed:", authResult.error?.message);
      return authResult;
    }
    
    userId = authResult.userId;
    sessionId = authResult.sessionId;
    console.log("✅ Authentication passed for user:", userId);
  }

  // Step 2: Origin validation (if required)
  if (checkOrigin) {
    console.log("🌐 Validating origin...");
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    console.log(`Origin: ${origin}, Referer: ${referer}`);
    
    const originResult = validateOrigin(request);
    
    if (!originResult.success) {
      console.log("❌ Origin validation failed:", originResult.error?.message);
      return originResult;
    }
    
    console.log("✅ Origin validation passed");
  }

  // Step 3: CSRF validation (if required and user is authenticated)
  if (requireCSRF && sessionId) {
    console.log("🛡️ Validating CSRF token...");
    const csrfToken = extractCSRFToken(request);
    console.log(`CSRF Token found: ${csrfToken ? 'YES' : 'NO'}`);
    console.log(`Session ID: ${sessionId}`);
    
    if (!csrfToken) {
      console.log("❌ No CSRF token found in request");
      return {
        success: false,
        error: {
          type: "CSRF_INVALID",
          message: "Missing CSRF token in request headers",
          statusCode: 403,
        },
      };
    }
    
    const csrfResult = validateCSRFToken(csrfToken, sessionId);
    
    if (!csrfResult.success) {
      console.log("❌ CSRF validation failed:", csrfResult.error?.message);
      return csrfResult;
    }
    
    console.log("✅ CSRF validation passed");
  }

  // Step 4: Rate limiting (if required and user is authenticated)
  if (rateLimit && (userId || sessionId)) {
    const identifier = userId || sessionId || 'anonymous';
    console.log("⏱️ Checking rate limit for:", identifier);
    
    // Use streaming rate limiter for expensive operations
    const rateLimitResult = validateRateLimit(identifier, 'streaming');
    
    if (!rateLimitResult.success) {
      console.log("❌ Rate limit exceeded:", rateLimitResult.error?.message);
      return rateLimitResult;
    }
    
    console.log("✅ Rate limit check passed");
  }

  // Step 5: Custom validation (if provided)
  if (customValidation) {
    console.log("🔧 Running custom validation...");
    const customResult = await customValidation(request);
    
    if (!customResult.success) {
      console.log("❌ Custom validation failed:", customResult.error?.message);
      return customResult;
    }
    
    console.log("✅ Custom validation passed");
  }

  console.log("🎉 All security validations passed");
  
  return {
    success: true,
    userId,
    sessionId,
  };
}

/**
 * Secure API handler wrapper
 * Applies security checks and handles errors consistently
 */
export function withApiSecurity<T = any>(
  handler: (request: NextRequest, validationResult: SecurityValidationResult) => Promise<Response | T>,
  options: ApiSecurityOptions = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      // Run security validation
      const validationResult = await validateApiRequest(request, options);
      
      if (!validationResult.success) {
        // Log security violation
        console.warn("🚨 Security violation:", {
          url: request.url,
          method: request.method,
          error: validationResult.error?.type,
          message: validationResult.error?.message,
          userAgent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          duration: Date.now() - startTime,
        });
        
        return createSecurityResponse(validationResult.error!);
      }

      // Call the actual handler
      const result = await handler(request, validationResult);
      
      // If handler returns a Response, use it directly
      if (result instanceof Response) {
        // Record successful request for rate limiting (if applicable)
        if (options.rateLimit !== false && validationResult.userId) {
          recordSuccessfulRequest(validationResult.userId, 'streaming');
        }
        
        // Log successful request
        console.log("✅ API request completed successfully:", {
          url: request.url,
          method: request.method,
          userId: validationResult.userId,
          duration: Date.now() - startTime,
        });
        
        return result;
      }

      // If handler returns data, wrap it in a Response
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
          "X-XSS-Protection": "1; mode=block",
        },
      });
      
    } catch (error) {
      // Log unexpected errors
      console.error("💥 Unexpected error in secure API handler:", {
        url: request.url,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            type: "INTERNAL_ERROR",
            message: "An unexpected error occurred. Please try again later.",
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
          },
        }
      );
    }
  };
}

/**
 * Lightweight security check for less sensitive endpoints
 */
export function withBasicSecurity<T = any>(
  handler: (request: NextRequest, validationResult: SecurityValidationResult) => Promise<Response | T>
) {
  return withApiSecurity(handler, {
    requireAuth: true,
    requireCSRF: false, // Less strict for basic endpoints
    rateLimit: true,
    checkOrigin: false, // Less strict for basic endpoints
  });
}

/**
 * Maximum security for sensitive operations like streaming generation
 */
export function withMaximumSecurity<T = any>(
  handler: (request: NextRequest, validationResult: SecurityValidationResult) => Promise<Response | T>
) {
  return withApiSecurity(handler, {
    requireAuth: true,
    requireCSRF: true,
    rateLimit: true,
    checkOrigin: true,
    customValidation: async (request: Request) => {
      // Additional validation for sensitive operations
      const contentLength = request.headers.get('content-length');
      const maxContentLength = 10 * 1024; // 10KB max for form data
      
      if (contentLength && parseInt(contentLength) > maxContentLength) {
        return {
          success: false,
          error: {
            type: "VALIDATION_ERROR",
            message: "Request body too large",
            statusCode: 413,
          },
        };
      }
      
      return { success: true };
    },
  });
}