import type { HotelBlockData } from "../types";
import { BasePlaceBlock } from "./BasePlaceBlock";

export default class HotelBlock extends BasePlaceBlock<HotelBlockData> {
  // Block-specific properties
  protected blockType = "Hotel";
  protected blockTitle = "Hotel";
  protected primaryColor = "#8b5cf6";
  protected gradientStart = "#e9d5ff";
  protected gradientEnd = "#c4b5fd";
  protected autocompleteType = "hotel" as const;

  static get toolbox() {
    return {
      title: "Hotel",
      icon: `<svg width="17" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 12h4l2-2h2l2 2h4v5H2v-5z" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M12 7v5" stroke="currentColor" stroke-width="2"/>
        <path d="M8 17h8" stroke="currentColor" stroke-width="2"/>
        <path d="M3 7v10" stroke="currentColor" stroke-width="2"/>
        <path d="M21 7v10" stroke="currentColor" stroke-width="2"/>
        <path d="M4 4h16v3H4z" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>`,
    };
  }

  protected getBlockIcon(): string {
    return `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4 12 8-8 8 8M6 10.5V19c0 .6.4 1 1 1h3v-3c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v3h3c.6 0 1-.4 1-1v-8.5"/>
      </svg>
    `;
  }

  protected createDefaultData(data?: Partial<HotelBlockData>): HotelBlockData {
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
      __type: "hotel",
    };
  }

  protected getPlaceholder(): string {
    return 'Enter hotel name (e.g., "Hilton Tokyo")';
  }

  protected getClickPlaceholder(): string {
    return "Click to add hotel...";
  }

  protected getPlaceNumberDisplay(placeNumber: number): string {
    // Convert number to letter: 1->A, 2->B, 3->C, etc.
    return String.fromCharCode(64 + placeNumber);
  }
}
