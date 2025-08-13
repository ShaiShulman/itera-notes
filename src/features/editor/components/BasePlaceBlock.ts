import type { BasePlaceBlockData } from "../types";
import { formatDrivingTimeAndDistance } from "../utils/formatting";
import {
  attachAutocomplete,
  AutocompleteInstance,
  AutocompletePrediction,
} from "@/features/autocomplete/autocomplete";
import {
  MapBounds,
  listenForBoundsChanges,
  boundsToLocationBias,
} from "@/features/map/boundsManager";
import { AutocompleteLocationBias } from "@/features/autocomplete/types";
import { findPlaceByNameAction } from "../actions/places";
import { createImageSkeleton } from "@/components/ui/skeleton";
import { IconLoader, IconPaths } from "@/assets/icons/iconLoader";
import { BUTTON_DIMENSIONS, ICON_DIMENSIONS, BUTTON_STYLES } from "./constants";

// Debounce mechanism for place numbering updates
let numberingUpdateTimeout: NodeJS.Timeout | null = null;

// Global utility function to trigger place numbering updates
export function triggerPlaceNumberingUpdate() {
  if (typeof window !== "undefined") {
    // Debounce the numbering updates to avoid excessive triggering
    if (numberingUpdateTimeout) {
      clearTimeout(numberingUpdateTimeout);
    }

    numberingUpdateTimeout = setTimeout(() => {
      console.log("🔢 Triggering global place numbering update");
      window.dispatchEvent(new CustomEvent("editor:updatePlaceNumbers"));
      numberingUpdateTimeout = null;
    }, 200); // 200ms debounce
  }
}

export abstract class BasePlaceBlock<T extends BasePlaceBlockData> {
  protected data: T;
  protected wrapper: HTMLElement | null = null;
  protected isExpanded: boolean = false;
  protected imagePopover: HTMLElement | null = null;
  protected autocompleteInstance: AutocompleteInstance | null = null;
  protected currentMapBounds: MapBounds | null = null;
  private boundsChangeCleanup: (() => void) | null = null;
  private loadingSpinner: HTMLElement | null = null;

  // Editing state management
  private originalName: string = "";
  private isCurrentlyEditingName: boolean = false;
  private currentInputValue: string = "";

  protected abstract blockType: string;
  protected abstract blockTitle: string;
  protected abstract primaryColor: string;
  protected abstract gradientStart: string;
  protected abstract gradientEnd: string;
  protected abstract autocompleteType: "place" | "hotel";

  protected abstract getBlockIcon(): string;
  protected abstract createDefaultData(data?: Partial<T>): T;
  protected abstract getPlaceNumberDisplay(placeNumber: number): string;

  constructor({ data }: { data?: Partial<T> }) {
    this.data = this.createDefaultData(data);

    // Listen for driving time updates
    if (typeof window !== "undefined") {
      window.addEventListener(
        "editor:updateDrivingTimes",
        this.handleDrivingTimeUpdate
      );

      // Listen for place numbering updates
      window.addEventListener(
        "editor:updatePlaceNumbers",
        this.handlePlaceNumberingUpdate
      );
    }

    // Listen for map bounds changes
    this.boundsChangeCleanup = listenForBoundsChanges(this.handleBoundsChange);
  }

  // Handler for driving time updates
  private handleDrivingTimeUpdate = (event: Event) => {
    const customEvent = event as CustomEvent;
    const { drivingTimesByUid } = customEvent.detail;

    if (this.data.uid && drivingTimesByUid[this.data.uid]) {
      const { time, distance } = drivingTimesByUid[this.data.uid];
      this.data.drivingTimeFromPrevious = time;
      this.data.drivingDistanceFromPrevious = distance;

      // Re-render the collapsed view to show updated driving time
      if (!this.isExpanded) {
        this.renderCollapsed();
      }

      console.log(`🚗 ${this.blockType}: Updated driving time to ${time}m`);
    }
  };

  // Handler for place numbering updates
  private handlePlaceNumberingUpdate = () => {
    // Only update numbering if the block is currently rendered and collapsed (where numbering is shown)
    if (this.wrapper && !this.isExpanded && !this.isCurrentlyEditing()) {
      // Check if the number actually changed before re-rendering
      const currentNumber = this.calculatePlaceNumber();
      const existingNumberBadge = this.wrapper.querySelector(
        'div[style*="border-radius: 50%"]'
      ) as HTMLElement;

      if (existingNumberBadge) {
        const existingNumber = existingNumberBadge.textContent;
        const expectedNumber = this.getPlaceNumberDisplay(currentNumber);

        if (existingNumber === expectedNumber) {
          // Number hasn't changed, no need to re-render
          return;
        }

        // Only update the number badge to avoid refreshing photos
        existingNumberBadge.textContent = expectedNumber;
        console.log(
          `🔢 ${this.blockType}: Updated place number for ${this.data.name} from ${existingNumber} to ${expectedNumber}`
        );
      } else {
        // Number badge doesn't exist, need full re-render
        console.log(
          `🔢 ${this.blockType}: Full re-render needed for numbering ${this.data.name}`
        );
        this.renderCollapsed();
      }
    }
  };

  // Handler for map bounds changes
  private handleBoundsChange = (bounds: MapBounds) => {
    console.log(`🗺️ ${this.blockType}: Received new map bounds`, bounds);
    this.currentMapBounds = bounds;

    // If currently editing, recreate autocomplete with new bounds
    if (this.autocompleteInstance) {
      console.log(
        `🗺️ ${this.blockType}: Recreating autocomplete with new bounds`
      );
      this.recreateAutocompleteWithNewBounds();
    }
  };

  // Get location bias based on current map bounds
  protected getLocationBias(): AutocompleteLocationBias | undefined {
    if (this.currentMapBounds) {
      console.log(`🗺️ ${this.blockType}: Using map bounds for location bias`);
      return boundsToLocationBias(this.currentMapBounds);
    }

    console.log(
      `🗺️ ${this.blockType}: No map bounds available, using no location bias`
    );
    return undefined;
  }

  // Handle autocomplete selection
  protected handleAutocompleteSelection(
    prediction: AutocompletePrediction,
    statusIndicator: HTMLElement
  ) {
    this.data.status = "loading";
    this.updateStatusIndicator(statusIndicator, "loading");
    this.showLoadingSpinner();

    // Extract place details from the prediction
    const placeDetails = (prediction as any).place_details;

    if (placeDetails) {
      // Extract coordinates from geometry - handle both function and property formats
      let lat = 0;
      let lng = 0;

      if (placeDetails.geometry?.location) {
        const location = placeDetails.geometry.location;
        // Check if lat/lng are functions (Google Maps API format)
        if (typeof location.lat === "function") {
          lat = location.lat();
          lng = location.lng();
        } else {
          // Direct property access (alternative format)
          lat = location.lat || 0;
          lng = location.lng || 0;
        }
      }

      // Use the detailed place information
      this.data = {
        ...this.data,
        placeId: prediction.place_id,
        name: placeDetails.name || prediction.structured_formatting.main_text,
        address: placeDetails.formatted_address || "",
        lat: lat,
        lng: lng,
        rating: placeDetails.rating || 0,
        photoReferences:
          placeDetails.photos
            ?.map((photo: any) => {
              const photoRef = photo.photo_reference;
              console.log(
                "Photo reference:",
                photoRef
                  ? `${photoRef.substring(0, 20)}...${photoRef.substring(
                      photoRef.length - 20
                    )}`
                  : "none"
              );
              return photoRef;
            })
            .filter(Boolean) || [],
        description: placeDetails.editorial_summary?.overview || "",
        thumbnailUrl: placeDetails.photos?.[0]?.photo_reference || "",
        status: "found",
      };
    } else {
      // Use basic prediction information
      this.data = {
        ...this.data,
        placeId: prediction.place_id,
        name: prediction.structured_formatting.main_text,
        address: prediction.structured_formatting.secondary_text || "",
        status: "found",
      };
    }

    // Commit the autocomplete selection and end editing mode
    this.currentInputValue = this.data.name ?? "";
    this.isCurrentlyEditingName = false;

    this.updateStatusIndicator(statusIndicator, "found");
    this.hideLoadingSpinner();

    // Auto-collapse after successful selection
    setTimeout(() => {
      this.renderCollapsed(false);

      // Trigger editor change event
      if (this.wrapper) {
        const changeEvent = new Event("input", { bubbles: true });
        this.wrapper.dispatchEvent(changeEvent);
      }
    }, 500);
  }

  // Cleanup method to destroy autocomplete instance
  protected cleanupAutocomplete() {
    if (this.autocompleteInstance) {
      this.autocompleteInstance.destroy();
      this.autocompleteInstance = null;
    }
  }

  // Recreate autocomplete instance with updated bounds
  protected recreateAutocompleteWithNewBounds() {
    if (!this.autocompleteInstance) return;

    // Find the current input element
    const input = this.wrapper?.querySelector(
      'input[data-editing="true"]'
    ) as HTMLInputElement;
    if (!input) return;

    // Get current status indicator
    const statusIndicator = this.wrapper?.querySelector(
      "[data-status-indicator]"
    ) as HTMLElement;
    if (!statusIndicator) return;

    // Cleanup existing instance
    this.cleanupAutocomplete();

    // Create new instance with updated location bias
    const locationBias = this.getLocationBias();
    this.autocompleteInstance = attachAutocomplete(input, {
      type: this.autocompleteType,
      locationBias,
      onSelect: (prediction) => {
        this.handleAutocompleteSelection(prediction, statusIndicator);
      },
      onFreeTextSearch: async (text) => {
        // Check if this is an existing place (has placeId) - if so, just treat as free text
        const wasExistingPlace = !!this.originalName && !!this.data.placeId;

        if (wasExistingPlace) {
          // For existing places, just update the name as free text
          this.data.name = text;
          this.data.status = "free-text";
          this.updateStatusIndicator(statusIndicator, "free-text");
          console.log(
            `📝 ${this.blockType}: Existing place renamed to "${text}" (free text)`
          );
        } else {
          // For new places (no placeId), try to search for the text as a place
          this.data.status = "loading";
          this.updateStatusIndicator(statusIndicator, "loading");
          this.showLoadingSpinner();

          try {
            const searchResult = await findPlaceByNameAction(text);

            if (searchResult.success && searchResult.place) {
              // Place found! Update data with found place details
              this.data = {
                ...this.data,
                placeId: searchResult.place.placeId,
                name: searchResult.place.name,
                address: searchResult.place.address,
                lat: searchResult.place.lat,
                lng: searchResult.place.lng,
                rating: searchResult.place.rating || 0,
                photoReferences: searchResult.place.photoReferences,
                description: searchResult.place.description || "",
                thumbnailUrl: searchResult.place.thumbnailUrl || "",
                status: "found",
              };

              // Update currentInputValue to the found place name
              this.currentInputValue = searchResult.place.name;

              this.updateStatusIndicator(statusIndicator, "found");
              this.hideLoadingSpinner();
              console.log(
                `🔍 ${this.blockType}: Found place "${searchResult.place.name}" for query "${text}"`
              );
            } else {
              // No place found, treat as free text
              this.data.name = text;
              this.data.status = "not-found";
              this.updateStatusIndicator(statusIndicator, "not-found");
              this.hideLoadingSpinner();
              console.log(
                `🔍 ${this.blockType}: No place found for "${text}", treating as free text`
              );
            }
          } catch (error) {
            console.error(
              `🔍 ${this.blockType}: Search error for "${text}":`,
              error
            );
            // Error occurred, treat as free text
            this.data.name = text;
            this.data.status = "not-found";
            this.updateStatusIndicator(statusIndicator, "not-found");
            this.hideLoadingSpinner();
          }
        }

        this.commitEdit();
        this.renderCollapsed(false);

        // Trigger editor change event
        if (this.wrapper) {
          const changeEvent = new Event("input", { bubbles: true });
          this.wrapper.dispatchEvent(changeEvent);
        }
      },
      onFreeText: (text) => {
        // Fallback handler (shouldn't be called with onFreeTextSearch present)
        this.currentInputValue = text;
        this.commitEdit();
        this.renderCollapsed(false);

        // Trigger editor change event
        if (this.wrapper) {
          const changeEvent = new Event("input", { bubbles: true });
          this.wrapper.dispatchEvent(changeEvent);
        }
      },
      placeholder: this.getPlaceholder(),
      minLength: 2,
      maxResults: 6,
    });
  }

  render() {
    this.wrapper = document.createElement("div");
    this.wrapper.classList.add(`${this.blockType.toLowerCase()}-block`);
    this.wrapper.setAttribute("data-uid", this.data.uid || "");
    this.wrapper.setAttribute("data-lat", this.data.lat?.toString() || "0");
    this.wrapper.setAttribute("data-lng", this.data.lng?.toString() || "0");
    this.wrapper.style.cssText = `
      border: 2px solid ${this.primaryColor};
      border-radius: 12px;
      margin: 8px 0;
      background: linear-gradient(135deg, ${this.gradientStart} 0%, ${this.gradientEnd} 100%);
      position: relative;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    // Start in editing mode if no place is set
    const shouldStartEditing = !this.data.placeId && !this.data.name;

    // Use setTimeout to ensure DOM is fully updated before calculating place numbers
    setTimeout(() => {
      this.renderCollapsed(shouldStartEditing);
    }, 0);

    // Add click handler for expand/collapse (only when not editing)
    this.wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.isCurrentlyEditing()) {
        this.toggle();
      }
    });

    // Add event listeners for force expand/collapse
    this.wrapper.addEventListener("place:forceExpand", (e) => {
      e.stopPropagation();
      if (!this.isExpanded) {
        this.isExpanded = true;
        this.renderExpanded();
        console.log(`📍 ${this.blockType}: Force expanded ${this.data.name}`);
      }
    });

    this.wrapper.addEventListener("place:forceCollapse", (e) => {
      e.stopPropagation();
      if (this.isExpanded) {
        this.isExpanded = false;
        this.renderCollapsed();
        console.log(`📍 ${this.blockType}: Force collapsed ${this.data.name}`);
      }
    });

    // Add event listener for uncheck day finish
    this.wrapper.addEventListener("place:uncheckDayFinish", (e) => {
      e.stopPropagation();
      const customEvent = e as CustomEvent;
      const { excludeUid } = customEvent.detail;

      // Only uncheck if this is not the place that triggered the uncheck
      if (this.data.uid !== excludeUid && this.data.isDayFinish) {
        this.data.isDayFinish = false;

        // Re-render the collapsed view to show the updated button state
        if (!this.isExpanded) {
          this.renderCollapsed(false);
        }

        // Trigger editor change event
        const changeEvent = new Event("input", { bubbles: true });
        this.wrapper?.dispatchEvent(changeEvent);

        console.log(
          `🏁 ${this.blockType}: Unchecked day finish for ${this.data.name} due to another place being marked as finish`
        );
      }
    });

    return this.wrapper;
  }

  protected isCurrentlyEditing(): boolean {
    return this.wrapper?.querySelector('input[data-editing="true"]') !== null;
  }

  // Editing state management methods
  private startEditing(): void {
    this.originalName = this.data.name || "";
    this.currentInputValue = this.data.name || "";
    this.isCurrentlyEditingName = true;
    console.log(`${this.blockType}: Started editing "${this.originalName}"`);
  }

  private commitEdit(): void {
    if (this.isCurrentlyEditingName) {
      this.data.name = this.currentInputValue;

      // Only override status if it's not already "found" from a successful search
      if (this.data.status !== "found") {
        // Check if this creates a free text override for existing place
        if (this.isFreeTextForExistingPlace()) this.data.status = "free-text";
      }

      this.isCurrentlyEditingName = false;
    }
  }

  private revertEdit(): void {
    if (this.isCurrentlyEditingName) {
      this.currentInputValue = this.originalName;
      this.data.name = this.originalName;
      this.isCurrentlyEditingName = false;
      console.log(`${this.blockType}: Reverted edit to "${this.originalName}"`);
    }
  }

  private isFreeTextForExistingPlace(): boolean {
    return !!(
      this.data.placeId &&
      this.currentInputValue &&
      this.currentInputValue !== this.originalName
    );
  }

  protected calculatePlaceNumber(): number {
    // Find this place's position among blocks of the SAME TYPE within the same day
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) {
      console.log(`${this.blockType}: No editor element found, returning 1`);
      return 1;
    }

    const allBlocks = editorElement.querySelectorAll(".ce-block");
    let placeNumberInDay = 1;
    let foundCurrentPlace = false;
    let currentDay = 0;
    const blockTypeClass = `.${this.blockType.toLowerCase()}-block`;

    console.log(
      `${this.blockType}: Calculating number for "${this.data.name}" among ${allBlocks.length} blocks`
    );

    // Find all blocks and track day/place progression
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];

      // Check if this block contains a day block
      if (block.querySelector(".day-block")) {
        currentDay++;
        placeNumberInDay = 1; // Reset place counter for new day
        console.log(
          `${this.blockType}: Found day ${currentDay}, resetting counter to 1`
        );
      }
      // Check if this block contains a block of the SAME TYPE as this one
      else if (block.querySelector(blockTypeClass)) {
        const blockElement = block.querySelector(blockTypeClass);
        const isCurrentBlock =
          blockElement && blockElement.contains(this.wrapper);

        console.log(
          `${
            this.blockType
          }: Found ${this.blockType.toLowerCase()} block #${placeNumberInDay} in day ${currentDay}${
            isCurrentBlock ? " (THIS BLOCK)" : ""
          }`
        );

        if (isCurrentBlock) {
          foundCurrentPlace = true;
          break;
        }
        placeNumberInDay++;
      }
    }

    const finalNumber = foundCurrentPlace ? placeNumberInDay : 1;
    console.log(
      `${this.blockType}: Final calculated number ${finalNumber} for "${this.data.name}" (found=${foundCurrentPlace})`
    );
    return finalNumber;
  }

  protected renderCollapsed(isEditing: boolean = false) {
    if (!this.wrapper) return;

    // Clean up existing autocomplete instance when switching modes
    if (!isEditing) {
      this.cleanupAutocomplete();
      this.loadingSpinner = null;
    }

    this.wrapper.innerHTML = "";
    this.wrapper.style.padding = "12px 16px";

    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
    `;

    const leftContent = document.createElement("div");
    leftContent.style.cssText = "display: flex; align-items: center;";

    // Place number badge (circular)
    const placeNumber = this.calculatePlaceNumber();
    const numberBadge = document.createElement("div");
    numberBadge.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      margin-right: 12px;
      flex-shrink: 0;
    `;
    numberBadge.textContent = this.getPlaceNumberDisplay(placeNumber);

    // Main content container - consistent structure
    const contentContainer = document.createElement("div");
    contentContainer.style.cssText =
      "display: flex; align-items: center; flex: 1; gap: 8px;";

    // Thumbnail (if available and confirmed)
    if (!isEditing && this.data.thumbnailUrl) {
      const thumbnailContainer = document.createElement("div");
      thumbnailContainer.style.cssText = `
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        position: relative;
      `;

      const thumbnail = document.createElement("img");
      thumbnail.src = `/api/places/photos/${this.data.thumbnailUrl}?width=150`;
      thumbnail.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 4px;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;

      // Only show skeleton if image doesn't load quickly (indicating it's not cached)
      let skeleton: HTMLElement | null = null;
      let showSkeletonTimeout: number | null = null;

      // Show skeleton after 50ms if image hasn't loaded (not cached)
      showSkeletonTimeout = window.setTimeout(() => {
        skeleton = createImageSkeleton("24px", "24px");
        thumbnailContainer.appendChild(skeleton);
        showSkeletonTimeout = null;
      }, 50);

      thumbnail.addEventListener("load", () => {
        // Cancel skeleton if image loads quickly (cached)
        if (showSkeletonTimeout) {
          clearTimeout(showSkeletonTimeout);
          showSkeletonTimeout = null;
        }
        // Remove skeleton if it was shown
        if (skeleton) {
          skeleton.remove();
        }
        thumbnail.style.opacity = "1";
      });

      thumbnail.addEventListener("error", () => {
        // Cancel skeleton timeout
        if (showSkeletonTimeout) {
          clearTimeout(showSkeletonTimeout);
          showSkeletonTimeout = null;
        }
        // Remove skeleton if it was shown
        if (skeleton) {
          skeleton.remove();
        }
        // Keep the container but show nothing on error
      });

      thumbnailContainer.appendChild(thumbnail);
      contentContainer.appendChild(thumbnailContainer);
    }

    // Name/Input container
    const nameContainer = document.createElement("div");
    nameContainer.style.cssText =
      "flex: 1; display: flex; align-items: center; position: relative; min-width: 0;";

    if (isEditing) {
      // Start editing mode
      this.startEditing();

      // Editing mode: show input with autocomplete
      const inputContainer = document.createElement("div");
      inputContainer.style.cssText = `
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        min-width: 0;
        width: 100%;
      `;

      const placeInput = document.createElement("input");
      placeInput.type = "text";
      placeInput.setAttribute("data-editing", "true");
      placeInput.value = this.currentInputValue;
      placeInput.placeholder = this.getPlaceholder();
      placeInput.style.cssText = `
        width: 100%;
        background: white;
        border: 2px solid ${this.primaryColor};
        border-radius: 6px;
        padding: 6px 80px 6px 12px;
        font-size: 14px;
        font-weight: 500;
        color: #065f46;
        outline: none;
        transition: border-color 0.2s;
      `;

      // Setup autocomplete with new module
      const locationBias = this.getLocationBias();

      this.autocompleteInstance = attachAutocomplete(placeInput, {
        type: this.autocompleteType,
        locationBias,
        onSelect: (prediction) => {
          this.handleAutocompleteSelection(prediction, statusIndicator);
        },
        onFreeTextSearch: async (text) => {
          // Check if this is an existing place (has placeId) - if so, just treat as free text
          const wasExistingPlace = !!this.originalName && !!this.data.placeId;

          if (wasExistingPlace) {
            // For existing places, just update the name as free text
            this.data.name = text;
            this.data.status = "free-text";
            this.updateStatusIndicator(statusIndicator, "free-text");
            console.log(
              `📝 ${this.blockType}: Existing place renamed to "${text}" (free text)`
            );
          } else {
            // For new places (no placeId), try to search for the text as a place
            this.data.status = "loading";
            this.updateStatusIndicator(statusIndicator, "loading");
            this.showLoadingSpinner();

            try {
              const searchResult = await findPlaceByNameAction(text);

              if (searchResult.success && searchResult.place) {
                // Place found! Update data with found place details
                this.data = {
                  ...this.data,
                  placeId: searchResult.place.placeId,
                  name: searchResult.place.name,
                  address: searchResult.place.address,
                  lat: searchResult.place.lat,
                  lng: searchResult.place.lng,
                  rating: searchResult.place.rating || 0,
                  photoReferences: searchResult.place.photoReferences,
                  description: searchResult.place.description || "",
                  thumbnailUrl: searchResult.place.thumbnailUrl || "",
                  status: "found",
                };

                // Update currentInputValue to the found place name
                this.currentInputValue = searchResult.place.name;

                this.updateStatusIndicator(statusIndicator, "found");
                this.hideLoadingSpinner();
                console.log(
                  `🔍 ${this.blockType}: Found place "${searchResult.place.name}" for query "${text}"`
                );
              } else {
                // No place found, treat as free text
                this.data.name = text;
                this.data.status = "not-found";
                this.updateStatusIndicator(statusIndicator, "not-found");
                this.hideLoadingSpinner();
                console.log(
                  `🔍 ${this.blockType}: No place found for "${text}", treating as free text`
                );
              }
            } catch (error) {
              console.error(
                `🔍 ${this.blockType}: Search error for "${text}":`,
                error
              );
              // Error occurred, treat as free text
              this.data.name = text;
              this.data.status = "not-found";
              this.updateStatusIndicator(statusIndicator, "not-found");
              this.hideLoadingSpinner();
            }
          }

          this.commitEdit();
          this.renderCollapsed(false);

          // Trigger editor change event
          if (this.wrapper) {
            const changeEvent = new Event("input", { bubbles: true });
            this.wrapper.dispatchEvent(changeEvent);
          }
        },
        onFreeText: (text) => {
          // Fallback handler (shouldn't be called with onFreeTextSearch present)
          this.data.name = text;
          this.data.status = this.data.placeId ? "free-text" : "not-found";
          this.updateStatusIndicator(statusIndicator, this.data.status);
          this.renderCollapsed(false);
        },
        placeholder: this.getPlaceholder(),
        minLength: 2,
        maxResults: 6,
      });

      // Track input changes but don't update data immediately
      placeInput.addEventListener("input", (e) => {
        this.currentInputValue = (e.target as HTMLInputElement).value;
        // Don't update this.data.name until Enter or autocomplete selection
      });

      // Handle Escape key (Enter and Tab are handled by autocomplete)
      placeInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();

          // Revert changes
          this.revertEdit();

          // Exit editing mode and re-render
          this.renderCollapsed(false);
        }
      });

      // Handle blur event (focus loss to other elements)
      placeInput.addEventListener("blur", () => {
        // Small delay to allow autocomplete selection to complete
        setTimeout(() => {
          // Only revert if still in editing mode and autocomplete isn't open
          if (this.isCurrentlyEditingName && !this.autocompleteInstance) {
            console.log(`${this.blockType}: Focus lost, reverting edit`);

            // Revert changes
            this.revertEdit();

            // Exit editing mode and re-render
            this.renderCollapsed(false);
          }
        }, 200);
      });

      // Create confirm and cancel buttons inside the input
      const confirmButton = document.createElement("button");
      confirmButton.type = "button";
      confirmButton.style.cssText = `
        position: absolute;
        right: 36px;
        top: 50%;
        transform: translateY(-50%);
        background: ${this.primaryColor};
        color: white;
        border: none;
        padding: 4px;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        transition: all 0.2s ease;
        z-index: 10;
      `;
      confirmButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
      confirmButton.title = "Confirm";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.style.cssText = `
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: #ef4444;
        color: white;
        border: none;
        padding: 4px;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        transition: all 0.2s ease;
        z-index: 10;
      `;
      cancelButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
      cancelButton.title = "Cancel";

      // Create spinner element and store reference
      const spinner = document.createElement("div");
      this.loadingSpinner = spinner;
      spinner.style.cssText = `
        position: absolute;
        right: 110px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top: 2px solid ${this.primaryColor};
        border-radius: 50%;
        animation: spin 1s linear infinite;
        display: none;
        z-index: 10;
      `;

      // Add CSS animation for spinner
      if (!document.getElementById("spinner-styles")) {
        const style = document.createElement("style");
        style.id = "spinner-styles";
        style.textContent = `
          @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      // Add event listeners for buttons
      confirmButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const enterEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        });
        placeInput.dispatchEvent(enterEvent);
      });

      cancelButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.revertEdit();
        this.renderCollapsed(false);
      });

      // Add hover effects
      confirmButton.addEventListener("mouseenter", () => {
        confirmButton.style.transform = "translateY(-50%) scale(1.1)";
      });
      confirmButton.addEventListener("mouseleave", () => {
        confirmButton.style.transform = "translateY(-50%) scale(1)";
      });

      cancelButton.addEventListener("mouseenter", () => {
        cancelButton.style.transform = "translateY(-50%) scale(1.1)";
      });
      cancelButton.addEventListener("mouseleave", () => {
        cancelButton.style.transform = "translateY(-50%) scale(1)";
      });

      inputContainer.appendChild(placeInput);
      inputContainer.appendChild(spinner);
      inputContainer.appendChild(confirmButton);
      inputContainer.appendChild(cancelButton);
      nameContainer.appendChild(inputContainer);

      // Focus the input
      setTimeout(() => {
        placeInput.focus();
        if (placeInput.value) {
          placeInput.select();
        }
      }, 100);
    } else if (this.data.placeId && this.data.name) {
      // Confirmed mode: show place name
      const placeNameContainer = document.createElement("div");
      placeNameContainer.style.cssText =
        "display: flex; align-items: center; gap: 6px;";

      const placeName = document.createElement("span");

      // Check if this is free text for an existing place
      const isFreeText = this.data.status === "free-text" && this.data.placeId;

      placeName.style.cssText = `
        color: ${isFreeText ? "#6b7280" : "#065f46"};
        font-weight: ${isFreeText ? "400" : "500"};
        font-size: 14px;
        cursor: pointer;
        transition: color 0.2s ease;
        font-style: ${isFreeText ? "italic" : "normal"};
      `;
      placeName.textContent = this.data.name;

      // Add hover functionality for visual feedback
      placeName.addEventListener("mouseenter", (e) => {
        e.stopPropagation();
        placeName.style.color = isFreeText ? "#4b5563" : "#059669";
        placeName.style.cursor = "pointer";
      });

      placeName.addEventListener("mouseleave", (e) => {
        e.stopPropagation();
        placeName.style.color = isFreeText ? "#6b7280" : "#065f46";
      });

      // Make place name clickable to enter edit mode
      placeName.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renderCollapsed(true);
      });

      placeNameContainer.appendChild(placeName);

      nameContainer.appendChild(placeNameContainer);
    } else if (!this.data.name) {
      // Placeholder mode (no name at all)
      const placeholderText = document.createElement("span");
      placeholderText.style.cssText = `
        color: #065f46;
        font-weight: 400;
        font-size: 14px;
        cursor: pointer;
      `;
      placeholderText.textContent = this.getClickPlaceholder();

      placeholderText.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renderCollapsed(true);
      });

      nameContainer.appendChild(placeholderText);
    } else {
      // Has name but no placeId (place not found)
      const notFoundContainer = document.createElement("div");
      notFoundContainer.style.cssText =
        "display: flex; align-items: center; gap: 6px;";

      const placeName = document.createElement("span");
      placeName.style.cssText = `
        color: #374151;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: color 0.2s ease;
      `;
      placeName.textContent = this.data.name;

      // Add hover functionality for visual feedback
      placeName.addEventListener("mouseenter", (e) => {
        e.stopPropagation();
        placeName.style.color = "#111827";
        placeName.style.cursor = "pointer";
      });

      placeName.addEventListener("mouseleave", (e) => {
        e.stopPropagation();
        placeName.style.color = "#374151";
      });

      // Make place name clickable to enter edit mode
      placeName.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renderCollapsed(true);
      });

      notFoundContainer.appendChild(placeName);
      nameContainer.appendChild(notFoundContainer);
    }

    contentContainer.appendChild(nameContainer);

    // Status indicator (consistent position)
    const statusIndicator = document.createElement("div");
    statusIndicator.setAttribute("data-status-indicator", "true");
    statusIndicator.style.cssText = `
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;
    statusIndicator.title =
      "This is a custom name for the place. The original place data is preserved.";

    if (isEditing) {
      this.updateStatusIndicator(statusIndicator, this.data.status || "idle");
    } else if (this.data.status === "not-found") {
      // Show red alert for places that couldn't be found
      this.updateStatusIndicator(statusIndicator, "not-found");
    } else if (this.data.status === "free-text") {
      // Show text indicator for free text entries
      statusIndicator.innerHTML = `
        <div style="
          width: 16px; 
          height: 16px; 
          background: #6b7280; 
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: 8px; font-weight: bold;">T</span>
        </div>
      `;
    } else {
      // Hide status indicator for confirmed places (no more checkmarks)
      statusIndicator.style.display = "none";
    }

    // Only show status indicator when not editing
    if (!isEditing) {
      contentContainer.appendChild(statusIndicator);
    }

    // Driving time display (if available and confirmed)
    if (
      !isEditing &&
      this.data.drivingTimeFromPrevious &&
      this.data.drivingTimeFromPrevious > 0
    ) {
      const drivingTime = document.createElement("span");
      drivingTime.style.cssText = `
        color: #6b7280;
        font-size: 12px;
        margin-left: 8px;
        display: flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
      `;

      const formattedDriving = formatDrivingTimeAndDistance(
        this.data.drivingTimeFromPrevious,
        this.data.drivingDistanceFromPrevious || 0
      );

      drivingTime.innerHTML = `<svg fill="#000000" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6.62,13.08a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3,1.15,1.15,0,0,0,.33-.21,1.15,1.15,0,0,0,.21-.33A.84.84,0,0,0,8,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,6.62,13.08Zm13.14-4L18.4,5.05a3,3,0,0,0-2.84-2H8.44A3,3,0,0,0,5.6,5.05L4.24,9.11A3,3,0,0,0,2,12v4a3,3,0,0,0,2,2.82V20a1,1,0,0,0,2,0V19H18v1a1,1,0,0,0,2,0V18.82A3,3,0,0,0,22,16V12A3,3,0,0,0,19.76,9.11ZM7.49,5.68A1,1,0,0,1,8.44,5h7.12a1,1,0,0,1,1,.68L17.61,9H6.39ZM20,16a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V12a1,1,0,0,1,1-1H19a1,1,0,0,1,1,1Zm-3.38-2.92a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3.9.9,0,0,0,.54-.54A.84.84,0,0,0,18,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,16.62,13.08ZM13,13H11a1,1,0,0,0,0,2h2a1,1,0,0,0,0-2Z"/></svg>
        ${formattedDriving}
      `;
      contentContainer.appendChild(drivingTime);
    }

    // Expand arrow (show if place exists or has a name for notes)
    const rightContent = document.createElement("div");
    rightContent.style.cssText =
      "display: flex; align-items: center; gap: 4px;";

    // Action buttons (show when not editing and has a name)
    if (!isEditing && this.data.name) {
      const buttonsContainer = document.createElement("div");
      buttonsContainer.style.cssText =
        "display: flex; align-items: center; gap: 4px; margin-right: 4px;";

      // Create all buttons in the correct order
      this.createActionButtonsInOrder(buttonsContainer);

      rightContent.appendChild(buttonsContainer);

      // Expand arrow
      const expandArrow = document.createElement("div");
      expandArrow.style.cssText = `
        color: ${this.primaryColor};
        font-size: 18px;
        transform: rotate(${this.isExpanded ? "180deg" : "0deg"});
        transition: transform 0.2s ease;
        margin-left: 4px;
      `;
      expandArrow.innerHTML = "▼";
      rightContent.appendChild(expandArrow);
    } else if (!isEditing && !this.data.name) {
      // Just show expand arrow for empty blocks
      const expandArrow = document.createElement("div");
      expandArrow.style.cssText = `
        color: ${this.primaryColor};
        font-size: 18px;
        transform: rotate(${this.isExpanded ? "180deg" : "0deg"});
        transition: transform 0.2s ease;
        margin-left: 8px;
      `;
      expandArrow.innerHTML = "▼";
      rightContent.appendChild(expandArrow);
    }

    leftContent.appendChild(numberBadge);
    leftContent.appendChild(contentContainer);
    header.appendChild(leftContent);
    header.appendChild(rightContent);
    this.wrapper?.appendChild(header);
  }

  protected renderExpanded() {
    if (!this.wrapper) return;

    // Exit edit mode for all other elements when this one is expanded
    this.exitEditModeForOtherElements();

    this.wrapper.innerHTML = "";
    this.wrapper.style.padding = "16px 20px";

    // Always show the expanded interface when we have a name
    if (this.data.name) {
      this.renderFoundPlace();
    }
  }

  protected renderFoundPlace() {
    if (!this.wrapper) return;

    // Header with collapse button
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      cursor: pointer;
    `;

    const leftContent = document.createElement("div");
    leftContent.style.cssText = "display: flex; align-items: center;";

    // Place number badge (circular) - keep when expanded
    const placeNumber = this.calculatePlaceNumber();
    const numberBadge = document.createElement("div");
    numberBadge.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 12px;
      margin-right: 12px;
      flex-shrink: 0;
    `;
    numberBadge.textContent = this.getPlaceNumberDisplay(placeNumber);

    // Block type icon (house for hotels, marker for places)
    const typeIcon = document.createElement("div");
    typeIcon.style.cssText = `
      color: ${this.primaryColor};
      margin-right: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    `;
    typeIcon.innerHTML = this.getBlockIcon();

    const placeNameContainer = document.createElement("div");
    placeNameContainer.style.cssText =
      "display: flex; align-items: center; gap: 8px;";

    const placeName = document.createElement("span");

    // Check if this is free text for an existing place
    const isFreeText = this.data.status === "free-text" && this.data.placeId;

    placeName.style.cssText = `
      color: ${isFreeText ? "#6b7280" : "#065f46"};
      font-weight: ${isFreeText ? "500" : "600"};
      font-size: 16px;
      font-style: ${isFreeText ? "italic" : "normal"};
    `;
    placeName.textContent = this.data.name || "";

    placeNameContainer.appendChild(placeName);

    // Add alert icon and tooltip for free text in expanded mode
    // if (isFreeText) {
    //   const alertIcon = document.createElement("div");
    //   alertIcon.style.cssText = `
    //     color: #f59e0b;
    //     cursor: help;
    //     display: flex;
    //     align-items: center;
    //   `;
    //   alertIcon.innerHTML = `
    //     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    //       <path d="M12 2L2 7v10c0 5.55 3.84 9.32 9 9.32s9-3.77 9-9.32V7l-10-5z"/>
    //       <path d="M12 8v4M12 16h0"/>
    //     </svg>
    //   `;
    //   alertIcon.title =
    //     "This is a custom name for the place. The original place data is preserved.";

    //   placeNameContainer.appendChild(alertIcon);
    // }

    // Make place name clickable to enter edit mode
    placeName.style.cursor = "pointer";
    placeName.addEventListener("click", (e) => {
      e.stopPropagation();
      this.renderCollapsed(true);
    });

    placeName.addEventListener("mouseenter", () => {
      placeName.style.textDecoration = "underline";
    });

    placeName.addEventListener("mouseleave", () => {
      placeName.style.textDecoration = "none";
    });

    // Collapse arrow
    const collapseArrow = document.createElement("div");
    collapseArrow.style.cssText = `
      color: ${this.primaryColor};
      font-size: 18px;
      transform: rotate(180deg);
      transition: transform 0.2s ease;
    `;
    collapseArrow.innerHTML = "▼";

    leftContent.appendChild(numberBadge);
    leftContent.appendChild(typeIcon);
    leftContent.appendChild(placeNameContainer);
    header.appendChild(leftContent);
    header.appendChild(collapseArrow);

    header.addEventListener("click", (e) => {
      // Check if click was on place name (which should trigger edit mode)
      if (e.target === placeName) {
        // Place name click is handled by its own event listener
        return;
      }
      e.stopPropagation();
      this.toggle();
    });

    // Images section - 4 smaller images in a 2x2 grid (only for found places)
    const imagesSection = document.createElement("div");
    imagesSection.style.cssText = `
      margin-bottom: 16px;
    `;

    if (
      this.data.placeId &&
      this.data.photoReferences &&
      this.data.photoReferences.length > 0
    ) {
      const imagesGrid = document.createElement("div");
      imagesGrid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        margin-bottom: 12px;
        max-width: 240px;
      `;

      // Show up to 4 images
      const imagesToShow = this.data.photoReferences.slice(0, 4);

      imagesToShow.forEach((photoRef) => {
        const imageContainer = document.createElement("div");
        imageContainer.style.cssText = `
          position: relative;
          width: 80px;
          height: 80px;
          border-radius: 6px;
          overflow: hidden;
          background: #f3f4f6;
        `;

        const image = document.createElement("img");
        image.src = `/api/places/photos/${photoRef}?width=400`;
        image.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.2s ease, opacity 0.3s ease;
          opacity: 0;
        `;

        // Only show skeleton if image doesn't load quickly (indicating it's not cached)
        let skeleton: HTMLElement | null = null;
        let showSkeletonTimeout: number | null = null;

        // Show skeleton after 50ms if image hasn't loaded (not cached)
        showSkeletonTimeout = window.setTimeout(() => {
          skeleton = createImageSkeleton("80px", "80px");
          imageContainer.appendChild(skeleton);
          showSkeletonTimeout = null;
        }, 50);

        // Image load success
        image.addEventListener("load", () => {
          // Cancel skeleton if image loads quickly (cached)
          if (showSkeletonTimeout) {
            clearTimeout(showSkeletonTimeout);
            showSkeletonTimeout = null;
          }
          // Remove skeleton if it was shown
          if (skeleton) {
            skeleton.remove();
          }
          image.style.opacity = "1";
        });

        // Add hover effect and image popup (only after loaded)
        image.addEventListener("mouseenter", () => {
          if (image.style.opacity === "1") {
            image.style.transform = "scale(1.05)";
            this.showImagePopover(
              image,
              `/api/places/photos/${photoRef}?width=600`
            );
          }
        });

        image.addEventListener("mouseleave", () => {
          image.style.transform = "scale(1)";
          this.hideImagePopover();
        });

        // Handle loading error
        image.addEventListener("error", () => {
          // Cancel skeleton timeout
          if (showSkeletonTimeout) {
            clearTimeout(showSkeletonTimeout);
            showSkeletonTimeout = null;
          }
          // Remove skeleton if it was shown
          if (skeleton) {
            skeleton.remove();
          }
          imageContainer.style.background = "#e5e7eb";
          imageContainer.innerHTML = `
            <div style="
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #9ca3af;
              font-size: 12px;
            ">
              Image unavailable
            </div>
          `;
        });

        imageContainer.appendChild(image);
        imagesGrid.appendChild(imageContainer);
      });

      imagesSection.appendChild(imagesGrid);
    }

    if (
      this.data.placeId &&
      this.data.description &&
      this.data.description !== ""
    ) {
      const descriptionContainer = document.createElement("div");
      descriptionContainer.style.cssText = `
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 1px solid #0ea5e9;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
      `;

      const description = document.createElement("p");
      description.style.cssText = `
        color: #1e293b;
        font-size: 14px;
        margin: 0;
        line-height: 1.6;
        font-style: italic;
        text-align: justify;
      `;
      description.textContent = `"${this.data.description}"`;

      descriptionContainer.appendChild(description);
      imagesSection.appendChild(descriptionContainer);
    }

    // Place details section (only for found places)
    const detailsSection = document.createElement("div");
    detailsSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    if (this.data.placeId && this.data.address) {
      const addressContainer = document.createElement("div");
      addressContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      const addressIcon = document.createElement("div");
      addressIcon.style.cssText = "color: #6b7280; flex-shrink: 0;";
      addressIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;

      const address = document.createElement("span");
      address.style.cssText = `
        color: #6b7280;
        font-size: 12px;
        line-height: 1.4;
      `;
      address.textContent = this.data.address;

      addressContainer.appendChild(addressIcon);
      addressContainer.appendChild(address);
      detailsSection.appendChild(addressContainer);
    }

    if (this.data.placeId && this.data.rating) {
      const ratingContainer = document.createElement("div");
      ratingContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      const ratingIcon = document.createElement("div");
      ratingIcon.style.cssText = "color: #fbbf24; flex-shrink: 0;";
      ratingIcon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      `;

      const rating = document.createElement("span");
      rating.style.cssText = `
        color: #374151;
        font-size: 12px;
        font-weight: 500;
      `;
      rating.textContent = `${this.data.rating}/5`;

      ratingContainer.appendChild(ratingIcon);
      ratingContainer.appendChild(rating);
      detailsSection.appendChild(ratingContainer);
    }

    // Notes section
    const notesTextarea = document.createElement("textarea");
    notesTextarea.placeholder = `Add your notes about this ${this.blockType.toLowerCase()}...`;
    notesTextarea.value = this.data.notes || "";
    notesTextarea.style.cssText = `
      width: 100%;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 8px 12px;
      background: white;
      color: #065f46;
      font-size: 14px;
      resize: vertical;
      min-height: 60px;
      outline: none;
      margin-bottom: 16px;
    `;
    notesTextarea.rows = 3;

    notesTextarea.addEventListener("input", (e) => {
      this.data.notes = (e.target as HTMLTextAreaElement).value;
    });

    notesTextarea.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    // Add Enter key handler for notes textarea
    notesTextarea.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        this.saveAndCollapse();
      }
    });

    // Save button container (positioned bottom right)
    const saveButtonContainer = document.createElement("div");
    saveButtonContainer.style.cssText = `
      display: flex;
      justify-content: flex-end;
    `;

    const saveButton = document.createElement("button");
    saveButton.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      border: none;
      padding: 8px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
    `;
    saveButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="17,21 17,13 7,13 7,21" stroke="currentColor" stroke-width="2" fill="none"/>
        <polyline points="7,3 7,8 15,8" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    `;
    saveButton.title = "Save and collapse";

    saveButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.saveAndCollapse();
    });

    saveButton.addEventListener("mouseenter", () => {
      saveButton.style.transform = "scale(1.05)";
      saveButton.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
    });

    saveButton.addEventListener("mouseleave", () => {
      saveButton.style.transform = "scale(1)";
      saveButton.style.boxShadow = "none";
    });

    saveButtonContainer.appendChild(saveButton);

    this.wrapper.appendChild(header);
    this.wrapper.appendChild(imagesSection);
    this.wrapper.appendChild(detailsSection);
    this.wrapper.appendChild(notesTextarea);
    this.wrapper.appendChild(saveButtonContainer);
  }

  protected updateStatusIndicator(indicator: HTMLElement, status: string) {
    switch (status) {
      case "loading":
        indicator.innerHTML = `
          <div style="
            width: 16px; 
            height: 16px; 
            border: 2px solid #e5e7eb; 
            border-top: 2px solid ${this.primaryColor}; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
          "></div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        `;
        break;
      case "found":
        indicator.innerHTML = `
          <div style="
            width: 16px; 
            height: 16px; 
            background: ${this.primaryColor}; 
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="Place found">
            <span style="color: white; font-size: 10px; font-weight: bold;">✓</span>
          </div>
        `;
        break;
      case "free-text":
        indicator.innerHTML = `
          <div style="
            width: 16px; 
            height: 16px; 
            background: #6b7280; 
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="This is a custom name for the place. The original place data is preserved">
            <span style="color: white; font-size: 8px; font-weight: bold;">T</span>
          </div>
        `;
        break;
      case "error":
      case "not-found":
        indicator.innerHTML = `
          <div style="
            width: 16px; 
            height: 16px; 
            background: #ef4444; 
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          " title="This place could not be found">
            <span style="color: white; font-size: 10px; font-weight: bold;">!</span>
          </div>
        `;
        break;
      default:
        indicator.innerHTML = "";
    }
  }

  protected saveAndCollapse() {
    console.log(`${this.blockType}: Saving ${this.data.name} and collapsing`);

    // Collapse the block
    this.isExpanded = false;
    this.renderCollapsed();

    // Trigger a content change event to save the editor state
    if (this.wrapper) {
      const changeEvent = new Event("input", { bubbles: true });
      this.wrapper.dispatchEvent(changeEvent);
    }
  }

  protected showImagePopover(imageElement: HTMLImageElement, photoRef: string) {
    // Clear any existing popover
    this.hideImagePopover();

    // Create popover element
    this.imagePopover = document.createElement("div");
    this.imagePopover.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid ${this.primaryColor};
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      padding: 8px;
      z-index: 2000;
      max-width: 90vw;
      max-height: 90vh;
      pointer-events: none;
    `;

    // Create larger image
    const largeImage = document.createElement("img");
    largeImage.src = photoRef;
    largeImage.style.cssText = `
      width: auto;
      height: auto;
      max-width: 400px;
      max-height: 400px;
      border-radius: 8px;
      object-fit: cover;
      display: block;
    `;

    // Add loading placeholder
    largeImage.addEventListener("error", () => {
      this.imagePopover!.innerHTML = `
        <div style="
          width: 300px;
          height: 200px;
          background: #f3f4f6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ca3af;
          font-size: 14px;
        ">
          Large image unavailable
        </div>
      `;
    });

    this.imagePopover.appendChild(largeImage);
    document.body.appendChild(this.imagePopover);
  }

  protected hideImagePopover() {
    if (this.imagePopover) {
      this.imagePopover.remove();
      this.imagePopover = null;
    }
  }

  // Show/hide loading spinner methods
  protected showLoadingSpinner() {
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = "block";
    }
  }

  protected hideLoadingSpinner() {
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = "none";
    }
  }

  // Exit edit mode for all other elements
  protected exitEditModeForOtherElements() {
    // Find all place and hotel blocks in the editor
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) return;

    const allPlaceBlocks = editorElement.querySelectorAll(
      ".place-block, .hotel-block"
    );

    allPlaceBlocks.forEach((block) => {
      // Skip this current block
      if (block === this.wrapper) return;

      // Check if block is in edit mode
      const editingInput = block.querySelector('input[data-editing="true"]');
      if (editingInput) {
        // Trigger escape to exit edit mode
        const escapeEvent = new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        });
        editingInput.dispatchEvent(escapeEvent);
      }
    });
  }

  // Helper method to create action buttons with SVG icons loaded from files
  protected async createActionButton(
    iconPath: string,
    tooltip: string,
    onClick: () => void,
    isActive: boolean,
    buttonId?: string
  ): Promise<HTMLElement> {
    const button = document.createElement("button");
    button.type = "button";
    button.style.cssText = `
      background: ${isActive ? this.primaryColor : "transparent"};
      color: ${isActive ? "white" : "#6b7280"};
      border: 1px solid ${isActive ? this.primaryColor : "#e5e7eb"};
      border-radius: ${BUTTON_STYLES.BORDER_RADIUS}px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${BUTTON_DIMENSIONS.WIDTH}px;
      height: ${BUTTON_DIMENSIONS.HEIGHT}px;
      transition: ${BUTTON_STYLES.TRANSITION};
      box-shadow: ${BUTTON_STYLES.BOX_SHADOW};
      flex-shrink: 0;
    `;

    // Create container for the SVG icon
    const iconContainer = document.createElement("div");
    iconContainer.style.cssText = `
      width: ${ICON_DIMENSIONS.WIDTH}px; 
      height: ${ICON_DIMENSIONS.HEIGHT}px; 
      display: flex; 
      align-items: center; 
      justify-content: center;
    `;

    // Load SVG content from file
    try {
      const svgContent = await IconLoader.loadIcon(iconPath);
      iconContainer.innerHTML = svgContent;

      // Apply proper styling to the SVG
      const svg = iconContainer.querySelector("svg");
      if (svg) {
        svg.style.width = `${ICON_DIMENSIONS.WIDTH}px`;
        svg.style.height = `${ICON_DIMENSIONS.HEIGHT}px`;
        svg.style.fill = "currentColor";
      }
    } catch (error) {
      console.error(`Failed to load icon from ${iconPath}:`, error);
      // Fallback to a simple dot if icon fails to load
      iconContainer.innerHTML = `<div style="width: 6px; height: 6px; background: currentColor; border-radius: 50%;"></div>`;
    }

    button.appendChild(iconContainer);
    button.title = tooltip;

    // Add data attribute for identification if buttonId is provided
    if (buttonId) {
      button.setAttribute("data-button-id", buttonId);
    }

    // Event listeners
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });

    button.addEventListener("mouseenter", () => {
      if (!isActive) {
        button.style.background = "#f3f4f6";
        button.style.color = this.primaryColor;
        button.style.borderColor = this.primaryColor;
        button.style.transform = `scale(${BUTTON_STYLES.SCALE_HOVER})`;
        button.style.boxShadow = BUTTON_STYLES.HOVER_BOX_SHADOW;
      } else {
        button.style.transform = `scale(${BUTTON_STYLES.SCALE_HOVER})`;
        button.style.boxShadow = BUTTON_STYLES.ACTIVE_HOVER_BOX_SHADOW;
      }
    });

    button.addEventListener("mouseleave", () => {
      if (!isActive) {
        button.style.background = "transparent";
        button.style.color = "#6b7280";
        button.style.borderColor = "#e5e7eb";
        button.style.transform = `scale(${BUTTON_STYLES.SCALE_NORMAL})`;
        button.style.boxShadow = BUTTON_STYLES.BOX_SHADOW;
      } else {
        button.style.transform = `scale(${BUTTON_STYLES.SCALE_NORMAL})`;
        button.style.boxShadow = BUTTON_STYLES.BOX_SHADOW;
      }
    });

    return button;
  }

  // Create action buttons in the correct order to avoid inconsistency
  protected async createActionButtonsInOrder(
    buttonsContainer: HTMLElement
  ): Promise<void> {
    // Build button configurations using array construction
    const buttonConfigs = [
      // Conditionally include suggest similar place button (only for places, not hotels)
      ...(this.autocompleteType === "place"
        ? [
            {
              iconPath: IconPaths.LIGHTBULB,
              tooltip: "Suggest similar place",
              onClick: () => this.handleSuggestSimilar(),
              isActive: false,
              buttonId: "suggest-similar",
            },
          ]
        : []),

      // Hide in map toggle button
      {
        iconPath: IconPaths.BAN,
        tooltip: this.data.hideInMap ? "Show in map" : "Hide in map",
        onClick: () => this.handleToggleHideInMap(),
        isActive: this.data.hideInMap || false,
        buttonId: "hide-in-map",
      },

      // Define as day finish toggle button
      {
        iconPath: IconPaths.FLAG,
        tooltip: this.data.isDayFinish
          ? "Remove day finish"
          : "Define as day finish",
        onClick: () => this.handleToggleDayFinish(),
        isActive: this.data.isDayFinish || false,
        buttonId: "day-finish",
      },

      // Delete button
      {
        iconPath: IconPaths.TRASH_BIN,
        tooltip: `Delete this ${this.blockType.toLowerCase()}`,
        onClick: () => this.handleDeleteBlock(),
        isActive: false,
        buttonId: "delete",
      },
    ];

    // Create all buttons and append them using Promise.all for better performance
    const buttons = await Promise.all(
      buttonConfigs.map((config) =>
        this.createActionButton(
          config.iconPath,
          config.tooltip,
          config.onClick,
          config.isActive,
          config.buttonId
        )
      )
    );

    // Append all buttons to the container
    buttons.forEach((button) => buttonsContainer.appendChild(button));
  }

  // Update a specific action button's state without re-rendering the entire component
  protected updateActionButtonState(buttonId: string, isActive: boolean): void {
    if (!this.wrapper) {
      console.warn(
        `${this.blockType}: No wrapper found when updating button ${buttonId}`
      );
      return;
    }

    const button = this.wrapper.querySelector(
      `[data-button-id="${buttonId}"]`
    ) as HTMLElement;
    if (!button) {
      console.warn(
        `${this.blockType}: Button ${buttonId} not found when updating state`
      );
      return;
    }

    console.log(
      `${this.blockType}: Updating button ${buttonId} to ${
        isActive ? "active" : "inactive"
      } for ${this.data.name}`
    );

    // Update button appearance
    button.style.background = isActive ? this.primaryColor : "transparent";
    button.style.color = isActive ? "white" : "#6b7280";
    button.style.borderColor = isActive ? this.primaryColor : "#e5e7eb";

    // Update tooltip based on button type and state
    if (buttonId === "day-finish") {
      button.title = isActive ? "Remove day finish" : "Define as day finish";
    } else if (buttonId === "hide-in-map") {
      button.title = isActive ? "Show in map" : "Hide in map";
    }
  }

  // Action button handlers
  protected handleDeleteBlock() {
    // Show in-line delete alert instead of browser confirm
    this.showDeleteAlert();
  }

  protected showDeleteAlert() {
    if (!this.wrapper) return;

    // Remove any existing alert
    this.hideDeleteAlert();

    // Create alert container
    const alertContainer = document.createElement("div");
    alertContainer.className = "delete-alert";
    alertContainer.style.cssText = `
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      animation: slideDown 0.2s ease-out;
    `;

    // Add CSS animation if not already present
    if (!document.getElementById("delete-alert-styles")) {
      const style = document.createElement("style");
      style.id = "delete-alert-styles";
      style.textContent = `
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Alert content
    const alertContent = document.createElement("div");
    alertContent.style.cssText =
      "display: flex; align-items: center; gap: 8px;";

    // Warning icon
    const warningIcon = document.createElement("div");
    warningIcon.style.cssText = "color: #dc2626; flex-shrink: 0;";
    warningIcon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;

    // Alert text
    const alertText = document.createElement("span");
    alertText.style.cssText =
      "color: #991b1b; font-size: 14px; font-weight: 500;";
    alertText.textContent = `Delete this ${this.blockType.toLowerCase()}?`;

    alertContent.appendChild(warningIcon);
    alertContent.appendChild(alertText);

    // Buttons container
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.cssText =
      "display: flex; gap: 8px; align-items: center;";

    // Confirm delete button
    const confirmButton = document.createElement("button");
    confirmButton.style.cssText = `
      background: #dc2626;
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    confirmButton.textContent = "Delete";

    // Cancel button
    const cancelButton = document.createElement("button");
    cancelButton.style.cssText = `
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cancelButton.textContent = "Cancel";

    // Event listeners
    confirmButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.confirmDeleteBlock();
    });

    confirmButton.addEventListener("mouseenter", () => {
      confirmButton.style.background = "#b91c1c";
      confirmButton.style.transform = "scale(1.05)";
    });

    confirmButton.addEventListener("mouseleave", () => {
      confirmButton.style.background = "#dc2626";
      confirmButton.style.transform = "scale(1)";
    });

    cancelButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideDeleteAlert();
    });

    cancelButton.addEventListener("mouseenter", () => {
      cancelButton.style.background = "#f9fafb";
      cancelButton.style.borderColor = "#9ca3af";
      cancelButton.style.transform = "scale(1.05)";
    });

    cancelButton.addEventListener("mouseleave", () => {
      cancelButton.style.background = "transparent";
      cancelButton.style.borderColor = "#d1d5db";
      cancelButton.style.transform = "scale(1)";
    });

    buttonsContainer.appendChild(confirmButton);
    buttonsContainer.appendChild(cancelButton);

    alertContainer.appendChild(alertContent);
    alertContainer.appendChild(buttonsContainer);

    // Add to wrapper
    this.wrapper.appendChild(alertContainer);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideDeleteAlert();
    }, 5000);
  }

  protected hideDeleteAlert() {
    if (!this.wrapper) return;
    const existingAlert = this.wrapper.querySelector(".delete-alert");
    if (existingAlert) {
      existingAlert.remove();
    }
  }

  protected confirmDeleteBlock() {
    this.hideDeleteAlert();

    // Find the parent Editor.js block and get its index for proper deletion
    const editorBlock = this.wrapper?.closest(".ce-block");
    if (editorBlock) {
      // Dispatch a custom deletion event that the ItineraryEditor can handle
      // This will use the Editor.js blocks.delete(index) API properly
      const deleteEvent = new CustomEvent("block:requestDelete", {
        bubbles: true,
        detail: {
          blockElement: editorBlock,
          blockType: this.blockType,
          blockName: this.data.name,
        },
      });

      // Let the event bubble up to ItineraryEditor which has access to the editor instance
      editorBlock.dispatchEvent(deleteEvent);

      console.log(
        `🗑️ ${this.blockType}: Requested deletion for block ${this.data.name}`
      );
    }
  }

  protected handleToggleDayFinish() {
    const wasFinish = this.data.isDayFinish;
    this.data.isDayFinish = !this.data.isDayFinish;

    // If this place is now marked as finish, uncheck all other places
    if (this.data.isDayFinish && !wasFinish) {
      this.uncheckAllOtherDayFinishPlaces();
    }

    // Re-render the collapsed view to show the updated button state
    if (!this.isExpanded) {
      this.renderCollapsed(false);
    }

    // Trigger editor change event
    if (this.wrapper) {
      const changeEvent = new Event("input", { bubbles: true });
      this.wrapper.dispatchEvent(changeEvent);
    }

    console.log(
      `🏁 ${this.blockType}: Day finish toggled to ${this.data.isDayFinish} for ${this.data.name}`
    );
  }

  protected uncheckAllOtherDayFinishPlaces() {
    // Find all place and hotel blocks in the editor
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) return;

    const allPlaceBlocks = editorElement.querySelectorAll(
      ".place-block, .hotel-block"
    );

    allPlaceBlocks.forEach((block) => {
      // Skip this current block
      if (block === this.wrapper) return;

      // Dispatch a custom event to tell other blocks to uncheck their day finish
      // This will directly update their data, causing them to re-render with correct state
      const uncheckEvent = new CustomEvent("place:uncheckDayFinish", {
        detail: { excludeUid: this.data.uid },
        bubbles: true,
      });
      block.dispatchEvent(uncheckEvent);
    });

    console.log(
      `🏁 ${this.blockType}: Unchecked day finish for all other places when setting ${this.data.name} as finish`
    );
  }

  protected handleToggleHideInMap() {
    this.data.hideInMap = !this.data.hideInMap;

    // Re-render the collapsed view to show the updated button state
    if (!this.isExpanded) {
      this.renderCollapsed(false);
    }

    // Trigger editor change event
    if (this.wrapper) {
      const changeEvent = new Event("input", { bubbles: true });
      this.wrapper.dispatchEvent(changeEvent);
    }

    console.log(
      `👁️ ${this.blockType}: Hide in map toggled to ${this.data.hideInMap} for ${this.data.name}`
    );
  }

  protected async handleSuggestSimilar() {
    if (this.autocompleteType !== "place") return; // Only for places

    console.log(
      `💡 ${this.blockType}: Suggesting similar places for ${this.data.name}`
    );

    // TODO: Implement similar place suggestion logic
    // This could integrate with Google Places API to find similar places
    // For now, just show a placeholder
    alert(`Feature coming soon: Suggest similar places to ${this.data.name}`);
  }

  protected emitPlaceSelectionEvent(isSelected: boolean) {
    if (!this.data.uid) return;

    const event = new CustomEvent("place:selectionChanged", {
      detail: {
        uid: this.data.uid,
        isSelected,
        placeName: this.data.name,
      },
      bubbles: true,
    });

    if (this.wrapper) {
      this.wrapper.dispatchEvent(event);
    }

    console.log(
      `📍 ${this.blockType}: Emitted selection event for ${this.data.name} (${
        isSelected ? "selected" : "deselected"
      })`
    );
  }

  protected toggle() {
    this.isExpanded = !this.isExpanded;
    this.emitPlaceSelectionEvent(this.isExpanded);

    if (this.isExpanded) {
      this.renderExpanded();
    } else {
      this.renderCollapsed();
    }
  }

  // Abstract methods that subclasses must implement
  protected abstract getPlaceholder(): string;
  protected abstract getClickPlaceholder(): string;

  save(blockContent: HTMLElement) {
    const notesTextarea = blockContent.querySelector(
      `textarea[placeholder^="Add your notes about this ${this.blockType.toLowerCase()}"]`
    ) as HTMLTextAreaElement;

    return {
      uid: this.data.uid,
      placeId: this.data.placeId,
      name: this.data.name,
      address: this.data.address,
      rating: this.data.rating,
      photoReferences: this.data.photoReferences,
      lat: this.data.lat,
      lng: this.data.lng,
      notes: notesTextarea?.value || this.data.notes || "",
      description: this.data.description,
      thumbnailUrl: this.data.thumbnailUrl,
      status: this.data.status,
      drivingTimeFromPrevious: this.data.drivingTimeFromPrevious,
      drivingDistanceFromPrevious: this.data.drivingDistanceFromPrevious,
      isDayFinish: this.data.isDayFinish,
      hideInMap: this.data.hideInMap,
    };
  }

  // Cleanup method for when block is destroyed
  destroy() {
    // Cleanup autocomplete
    this.cleanupAutocomplete();

    // Cleanup map bounds listener
    if (this.boundsChangeCleanup) {
      this.boundsChangeCleanup();
      this.boundsChangeCleanup = null;
    }

    // Cleanup event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "editor:updateDrivingTimes",
        this.handleDrivingTimeUpdate
      );
      window.removeEventListener(
        "editor:updatePlaceNumbers",
        this.handlePlaceNumberingUpdate
      );
    }

    // Cleanup image popover
    this.hideImagePopover();
  }

  static get sanitize() {
    return {
      placeId: false,
      name: false,
      address: false,
      rating: false,
      photoReferences: false,
      lat: false,
      lng: false,
      notes: false,
      description: false,
      thumbnailUrl: false,
      status: false,
      isDayFinish: false,
      hideInMap: false,
    };
  }
}
