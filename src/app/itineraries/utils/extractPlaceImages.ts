import { EditorData } from "@/features/editor/types";

export interface PlaceImageData {
  name: string;
  thumbnailUrl?: string;
  photoReferences?: string[];
}

/**
 * Extract the first two places with images from an itinerary's editor data
 */
export function extractFirstTwoPlaceImages(editorData: EditorData): string[] {
  if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
    return [];
  }

  const placeImages: string[] = [];
  const places: PlaceImageData[] = [];

  // First, collect all places from the editor data
  for (const block of editorData.blocks) {
    if (
      (block.type === "place" || block.type === "hotel") &&
      placeImages.length < 2
    ) {
      const placeData = block.data as any;

      if (placeData?.name) {
        places.push({
          name: placeData.name,
          thumbnailUrl: placeData.thumbnailUrl,
          photoReferences: placeData.photoReferences,
        });
      }
    }
  }

  // Extract image URLs from the first 2 places
  for (let i = 0; i < Math.min(places.length, 2); i++) {
    const place = places[i];
    let imageUrl: string | null = null;

    // Try thumbnail URL first
    if (
      place.thumbnailUrl &&
      typeof place.thumbnailUrl === "string" &&
      place.thumbnailUrl.trim()
    ) {
      imageUrl = place.thumbnailUrl;
    }

    // If no thumbnail, try first photo reference
    if (
      !imageUrl &&
      place.photoReferences &&
      Array.isArray(place.photoReferences) &&
      place.photoReferences.length > 0
    ) {
      const firstPhoto = place.photoReferences[0];

      if (typeof firstPhoto === "string" && firstPhoto.trim()) {
        // Check if it's already a full URL
        if (firstPhoto.startsWith("http")) {
          imageUrl = firstPhoto;
        } else {
          imageUrl = `/api/places/photos/${firstPhoto}?width=400`;
        }
      }
    }

    if (imageUrl) {
      placeImages.push(imageUrl);
      console.log(`📸 DEBUG: Added image for ${place.name}:`, imageUrl);
    } else {
      console.log(`📸 DEBUG: No image URL generated for ${place.name}`, {
        thumbnailUrl: place.thumbnailUrl,
        photoReferences: place.photoReferences,
      });
    }
  }

  return placeImages;
}

/**
 * Extract place names from editor data for URL generation
 */
export function extractPlaceNamesForSlug(
  editorData: EditorData,
  maxPlaces: number = 2
): string[] {
  if (!editorData || !editorData.blocks || !Array.isArray(editorData.blocks)) {
    return [];
  }

  const placeNames: string[] = [];

  for (const block of editorData.blocks) {
    if (
      (block.type === "place" || block.type === "hotel") &&
      placeNames.length < maxPlaces
    ) {
      const placeData = block.data as any;

      if (placeData?.name && typeof placeData.name === "string") {
        // Clean place name for URL
        const cleanName = placeData.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, "") // Remove special characters
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/-+/g, "-") // Replace multiple hyphens with single
          .trim()
          .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens

        if (cleanName) {
          placeNames.push(cleanName);
        }
      }
    }
  }

  return placeNames;
}
