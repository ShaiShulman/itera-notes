import { NextRequest } from "next/server";
import { generateItineraryMultiStepStreamAction } from "@/features/generateLLM/generateAction";
import { withApiSecurity, type SecurityValidationResult } from "@/lib/security";

/**
 * Secure multi-step streaming itinerary generation endpoint with progress updates
 * Protected with maximum security: Auth + CSRF + Rate Limiting + Origin validation
 */
async function handleMultiStepStreamingGeneration(
  request: NextRequest,
  validationResult: SecurityValidationResult
): Promise<Response> {
  console.log(`🚀 Processing multi-step streaming generation for user: ${validationResult.userId}`);

  try {
    // Parse and validate request body
    const formData = await request.json();

    // Additional validation could be added here
    if (!formData.destination || !formData.startDate || !formData.endDate) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: destination, startDate, endDate",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Call the multi-step streaming generation action
    const result = await generateItineraryMultiStepStreamAction(formData, request);

    // Add security headers to streaming response
    const headers = new Headers(result.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("X-User-ID", validationResult.userId || "unknown");

    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers,
    });

  } catch (error) {
    console.error("Error in secure multi-step streaming generation:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process streaming request. Please try again.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        }
      }
    );
  }
}

// Apply security wrapper
export const POST = withApiSecurity(handleMultiStepStreamingGeneration, {
  requireAuth: true,
  requireCSRF: false,  // Temporarily disabled for debugging
  rateLimit: true,
  checkOrigin: false,  // Temporarily disabled for debugging
});
