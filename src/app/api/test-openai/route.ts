export async function GET() {
  try {
    console.log("🧪 Testing OpenAI configuration...");
    console.log("OPENAI_API_KEY exists:", !!process.env.OPENAI_API_KEY);
    console.log("OPENAI_API_KEY length:", process.env.OPENAI_API_KEY?.length || 0);
    console.log("OPENAI_MODEL:", process.env.OPENAI_MODEL || "gpt-4");

    // Test if we can import OpenAI
    const OpenAI = (await import("openai")).default;
    console.log("✅ OpenAI import successful");

    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "OPENAI_API_KEY is not set in environment variables",
          debug: {
            env_vars: Object.keys(process.env).filter(key => key.includes('OPENAI')),
            node_env: process.env.NODE_ENV,
          }
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Test OpenAI client creation
    new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log("✅ OpenAI client created successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "OpenAI configuration looks good",
        debug: {
          api_key_length: process.env.OPENAI_API_KEY.length,
          model: process.env.OPENAI_MODEL || "gpt-4",
          openai_client_created: true,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ OpenAI test failed:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "OpenAI configuration test failed",
        details: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}