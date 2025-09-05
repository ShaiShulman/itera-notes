import { auth } from "@/lib/auth";
import { generateCSRFToken } from "@/lib/security/csrfToken";

export async function POST() {
  try {
    // Validate authentication
    const session = await auth();
    
    if (!session || !session.user?.id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication required",
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Generate CSRF token
    const token = generateCSRFToken(session.user.id);
    
    console.log(`🛡️ Generated CSRF token for user: ${session.user.id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        token,
      }),
      { 
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff",
        }
      }
    );
    
  } catch (error) {
    console.error("Error generating CSRF token:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate CSRF token",
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}