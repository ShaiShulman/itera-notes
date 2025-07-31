import { NextRequest, NextResponse } from "next/server";
import { googlePhotosService } from "@/services/google/photos";
import { withPlacePhotosCache } from "@/services/google/cacheWrappers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const { searchParams } = new URL(request.url);
    const width = parseInt(searchParams.get("width") || "400");

    // Validate parameters
    if (!reference) {
      return NextResponse.json(
        { error: "Photo reference is required" },
        { status: 400 }
      );
    }

    if (width < 1 || width > 1600) {
      return NextResponse.json(
        { error: "Width must be between 1 and 1600 pixels" },
        { status: 400 }
      );
    }

    // Get photo with caching
    const base64Data = await withPlacePhotosCache(
      reference,
      width,
      () => googlePhotosService.fetchPhotoAsBase64(reference, width)
    );

    // Extract content type and base64 data from data URL
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 data format");
    }

    const [, contentType, base64Content] = matches;
    const imageBuffer = Buffer.from(base64Content, "base64");

    // Return image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "public, max-age=2592000, immutable", // 30 days, immutable
        "ETag": `"${reference}-${width}"`,
        "Expires": new Date(Date.now() + 2592000000).toUTCString(), // 30 days
      },
    });
  } catch (error) {
    console.error("Photo API error:", error);
    
    // Return a proper error response
    return NextResponse.json(
      { error: "Failed to fetch photo" },
      { status: 500 }
    );
  }
}