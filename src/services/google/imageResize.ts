/**
 * Image Resizing Utilities using Sharp
 * Handles server-side image processing for photo optimization
 */

import sharp from "sharp";
import {
  PHOTO_SETTINGS,
  shouldResize,
  isValidPhotoSize,
} from "./photoSettings";

/**
 * Error class for image processing errors
 */
export class ImageResizeError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = "ImageResizeError";
  }
}

/**
 * Resize image from base64 data URL to specified width
 * @param base64DataUrl - Original image as base64 data URL
 * @param targetWidth - Target width in pixels
 * @returns Promise<string> - Resized image as base64 data URL
 */
export async function resizeImageFromBase64(
  base64DataUrl: string,
  targetWidth: number
): Promise<string> {
  try {
    // Validate target width
    if (!isValidPhotoSize(targetWidth)) {
      throw new ImageResizeError(
        `Invalid photo size: ${targetWidth}px. Must be one of: ${Object.values(
          PHOTO_SETTINGS
        )
          .filter((v) => typeof v === "number")
          .join(", ")}`
      );
    }

    // Check if resize is needed
    if (!shouldResize(targetWidth)) {
      return base64DataUrl;
    }

    // Extract base64 data and content type
    const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new ImageResizeError("Invalid base64 data URL format");
    }

    const [, , base64Data] = matches;
    const inputBuffer = Buffer.from(base64Data, "base64");

    // Process with Sharp
    const startTime = Date.now();
    const resizedBuffer = await sharp(inputBuffer)
      .resize(targetWidth, null, {
        width: targetWidth,
        withoutEnlargement: true, // Don't enlarge smaller images
        fit: "inside", // Maintain aspect ratio
      })
      .jpeg({
        quality: PHOTO_SETTINGS.IMAGE_QUALITY,
        progressive: true,
      })
      .timeout({ seconds: PHOTO_SETTINGS.RESIZE_TIMEOUT_MS / 1000 })
      .toBuffer();

    const duration = Date.now() - startTime;
    const originalSize = Math.round(inputBuffer.length / 1024);
    const resizedSize = Math.round(resizedBuffer.length / 1024);
    const compressionRatio = Math.round(
      (1 - resizedBuffer.length / inputBuffer.length) * 100
    );

    console.log(
      `📸 Resize completed: ${PHOTO_SETTINGS.MASTER_SIZE}px→${targetWidth}px ` +
        `(${originalSize}KB→${resizedSize}KB, -${compressionRatio}%, ${duration}ms)`
    );

    // Convert back to base64 data URL
    const outputBase64 = resizedBuffer.toString("base64");
    return `data:image/jpeg;base64,${outputBase64}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`📸 Image resize failed for ${targetWidth}px:`, errorMessage);

    throw new ImageResizeError(
      `Failed to resize image to ${targetWidth}px: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Resize image buffer directly
 * @param inputBuffer - Original image buffer
 * @param targetWidth - Target width in pixels
 * @param contentType - Original content type
 * @returns Promise<Buffer> - Resized image buffer
 */
export async function resizeImageBuffer(
  inputBuffer: Buffer,
  targetWidth: number,
  contentType: string = "image/jpeg"
): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    if (!isValidPhotoSize(targetWidth)) {
      throw new ImageResizeError(`Invalid photo size: ${targetWidth}px`);
    }

    if (!shouldResize(targetWidth)) {
      return { buffer: inputBuffer, contentType };
    }

    console.log(`📸 Processing buffer resize to ${targetWidth}px`);

    const resizedBuffer = await sharp(inputBuffer)
      .resize(targetWidth, null, {
        width: targetWidth,
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({
        quality: PHOTO_SETTINGS.IMAGE_QUALITY,
        progressive: true,
      })
      .timeout({ seconds: PHOTO_SETTINGS.RESIZE_TIMEOUT_MS / 1000 })
      .toBuffer();

    return {
      buffer: resizedBuffer,
      contentType: "image/jpeg",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `📸 Buffer resize failed for ${targetWidth}px:`,
      errorMessage
    );

    throw new ImageResizeError(
      `Failed to resize buffer to ${targetWidth}px: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get image metadata
 * @param inputBuffer - Image buffer
 * @returns Promise with image metadata
 */
export async function getImageMetadata(inputBuffer: Buffer) {
  try {
    const metadata = await sharp(inputBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || "unknown",
      size: inputBuffer.length,
      channels: metadata.channels || 0,
    };
  } catch (error) {
    console.error("📸 Failed to get image metadata:", error);
    throw new ImageResizeError(
      "Failed to analyze image metadata",
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Validate image buffer
 * @param inputBuffer - Image buffer to validate
 * @returns Promise<boolean> - True if valid image
 */
export async function validateImageBuffer(
  inputBuffer: Buffer
): Promise<boolean> {
  try {
    await sharp(inputBuffer).metadata();
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper function to handle resize with retry logic
 * @param base64DataUrl - Original image
 * @param targetWidth - Target width
 * @param maxAttempts - Maximum retry attempts
 * @returns Promise<string> - Resized image or original on failure
 */
export async function resizeWithRetry(
  base64DataUrl: string,
  targetWidth: number,
  maxAttempts: number = PHOTO_SETTINGS.MAX_RESIZE_ATTEMPTS
): Promise<string> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await resizeImageFromBase64(base64DataUrl, targetWidth);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `📸 Resize attempt ${attempt}/${maxAttempts} failed:`,
        lastError.message
      );

      if (attempt < maxAttempts) {
        // Wait before retry (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  console.error(
    `📸 All ${maxAttempts} resize attempts failed for ${targetWidth}px, returning original`
  );
  console.error("📸 Final error:", lastError?.message);

  // Return original image as fallback
  return base64DataUrl;
}

const imageResize = {
  resizeImageFromBase64,
  resizeImageBuffer,
  getImageMetadata,
  validateImageBuffer,
  resizeWithRetry,
  ImageResizeError,
};

export default imageResize;
