import type { PlaceBlockData } from "../types";
import { BasePlaceBlock } from "./BasePlaceBlock";

export default class PlaceBlock extends BasePlaceBlock<PlaceBlockData> {
  // Block-specific properties
  protected blockType = "Place";
  protected blockTitle = "Place";
  protected primaryColor = "#10b981";
  protected gradientStart = "#d1fae5";
  protected gradientEnd = "#a7f3d0";
  protected autocompleteType = "place" as const;

  static get toolbox() {
    return {
      title: "Place",
      icon: `<svg width="17" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>`,
    };
  }

  protected getBlockIcon(): string {
    return `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 4px;">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2" fill="none"/>
        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    `;
  }

  protected createDefaultData(data?: Partial<PlaceBlockData>): PlaceBlockData {
    return {
      uid:
        data?.uid ||
        crypto.randomUUID(),
      placeId: data?.placeId || "",
      name: data?.name || "",
      shortName: data?.shortName || "",
      linkedParagraphId: data?.linkedParagraphId || "",
      address: data?.address || "",
      rating: data?.rating || 0,
      photoReferences: data?.photoReferences || [],
      lat: data?.lat || 0,
      lng: data?.lng || 0,
      notes: data?.notes || "",
      description: data?.description || "",
      thumbnailUrl: data?.thumbnailUrl || "",
      status: data?.status || "idle",
      drivingTimeFromPrevious: data?.drivingTimeFromPrevious || 0,
      drivingDistanceFromPrevious: data?.drivingDistanceFromPrevious || 0,
      isDayFinish: data?.isDayFinish || false,
      hideInMap: data?.hideInMap || false,
      __type: "place",
    };
  }

  protected getPlaceholder(): string {
    return 'Enter place name (e.g., "Tokyo Skytree")';
  }

  protected getClickPlaceholder(): string {
    return "Click to add place...";
  }

  protected getPlaceNumberDisplay(placeNumber: number): string {
    return placeNumber.toString();
  }
}
