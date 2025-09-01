import { NextRequest, NextResponse } from "next/server";
import { googlePhotosService } from "@/services/google/photos";
import { resizeWithRetry } from "@/services/google/imageResize";
import {
  PHOTO_SETTINGS,
  shouldResize,
  isValidPhotoSize,
} from "@/services/google/photoSettings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await params;
    const { searchParams } = new URL(request.url);
    const requestedWidth = parseInt(
      searchParams.get("width") || PHOTO_SETTINGS.DEFAULT_SIZE.toString()
    );

    // Validate parameters
    if (!reference || reference.trim() === "") {
      return NextResponse.json(
        { error: "Photo reference is required" },
        { status: 400 }
      );
    }

    // Additional validation for photo reference format
    if (reference.length < 10) {
      return NextResponse.json(
        { error: "Invalid photo reference format" },
        { status: 400 }
      );
    }

    // Validate requested width against allowed range
    if (!isValidPhotoSize(requestedWidth)) {
      return NextResponse.json(
        {
          error: `Invalid width. Must be between ${PHOTO_SETTINGS.MIN_SIZE}px and ${PHOTO_SETTINGS.MAX_SIZE}px`,
        },
        { status: 400 }
      );
    }

    const masterBase64Data = await googlePhotosService.fetchPhotoAsBase64(
      reference
    );

    // Resize if needed
    let finalBase64Data: string = "";
    if (shouldResize(requestedWidth)) {
      try {
        finalBase64Data = await resizeWithRetry(
          masterBase64Data,
          requestedWidth
        );
      } catch (resizeError: unknown) {
        console.error(
          `📸 Resize failed, using master:`,
          resizeError instanceof Error
            ? resizeError.message
            : String(resizeError)
        );
      }
    } else {
      finalBase64Data = masterBase64Data;
    }

    // Extract content type and base64 data from final image
    const matches = finalBase64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error("Invalid base64 data format");
    }

    const [, contentType, base64Content] = matches;
    const imageBuffer = Buffer.from(base64Content, "base64");

    console.log(
      `📸 Serving ${requestedWidth}px image: ${Math.round(
        imageBuffer.length / 1024
      )}KB`
    );

    // Return image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "public, max-age=2592000, immutable", // 30 days, immutable
        ETag: `"${reference}-${requestedWidth}"`,
        Expires: new Date(Date.now() + 2592000000).toUTCString(), // 30 days
      },
    });
  } catch (error) {
    console.error("📸 Photo API error:", error);
    console.error(
      "📸 Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );

    // Return a proper error response
    return NextResponse.json(
      {
        error: "Failed to fetch photo",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
