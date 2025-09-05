import { auth } from "@/lib/auth";
import type { SecurityValidationResult } from "./types";
import { SecurityErrors } from "./errors";

/**
 * Validates authentication for API requests
 * Returns user session information if authenticated
 */
export async function validateAuthentication(): Promise<SecurityValidationResult> {
  try {
    const session = await auth();
    
    if (!session || !session.user) {
      return {
        success: false,
        error: SecurityErrors.UNAUTHORIZED,
      };
    }

    // Additional validation - ensure session is still valid
    if (!session.user.id || !session.user.email) {
      return {
        success: false,
        error: SecurityErrors.UNAUTHORIZED,
      };
    }

    return {
      success: true,
      userId: session.user.id,
      sessionId: session.user.id, // Using user ID as session identifier
    };
  } catch (error) {
    console.error("Authentication validation error:", error);
    return {
      success: false,
      error: SecurityErrors.UNAUTHORIZED,
    };
  }
}

/**
 * Validates origin/referer headers to ensure request comes from allowed domains
 */
export function validateOrigin(request: Request): SecurityValidationResult {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  
  // In development, be more lenient
  if (process.env.NODE_ENV === "development") {
    // Allow localhost origins
    if (origin?.includes("localhost") || referer?.includes("localhost")) {
      return { success: true };
    }
  }

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    "https://your-production-domain.com", // Replace with actual domain
  ].filter(Boolean);

  // Check origin header
  if (origin && allowedOrigins.some(allowed => allowed && origin.startsWith(allowed))) {
    return { success: true };
  }

  // Check referer header (fallback)
  if (referer && allowedOrigins.some(allowed => allowed && referer.startsWith(allowed))) {
    return { success: true };
  }

  // Special case: Check if request comes from the create-itinerary page specifically
  if (referer?.includes("/create-itinerary")) {
    const refererOrigin = new URL(referer).origin;
    if (allowedOrigins.some(allowed => allowed && refererOrigin === allowed)) {
      return { success: true };
    }
  }

  return {
    success: false,
    error: SecurityErrors.ORIGIN_INVALID,
  };
}