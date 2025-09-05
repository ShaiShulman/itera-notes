import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    console.log("🐛 Debug Security Check Started");
    
    // Check authentication
    const session = await auth();
    console.log("Session exists:", !!session);
    console.log("User ID:", session?.user?.id);
    
    // Check headers
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const csrfToken = request.headers.get("X-CSRF-Token");
    const userAgent = request.headers.get("user-agent");
    
    console.log("Headers debug:");
    console.log("- Origin:", origin);
    console.log("- Referer:", referer);
    console.log("- CSRF Token:", csrfToken ? "Present" : "Missing");
    console.log("- User Agent:", userAgent?.substring(0, 50));
    
    // Check request body
    const body = await request.json();
    console.log("Request body keys:", Object.keys(body));
    
    return new Response(
      JSON.stringify({
        success: true,
        debug: {
          authenticated: !!session,
          userId: session?.user?.id,
          hasOrigin: !!origin,
          hasReferer: !!referer,
          hasCsrfToken: !!csrfToken,
          refererContainsCreateItinerary: referer?.includes("/create-itinerary"),
          bodyKeys: Object.keys(body),
        },
      }),
      { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
    
  } catch (error) {
    console.error("Debug security check error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}