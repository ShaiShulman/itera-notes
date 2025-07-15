import type { BasePlaceBlockData } from "../types";
import { formatDrivingTimeAndDistance } from "../utils/formatting";
import {
  attachAutocomplete,
  AutocompleteInstance,
  AutocompletePrediction,
} from "@/features/autocomplete/autocomplete";

export abstract class BasePlaceBlock<T extends BasePlaceBlockData> {
  protected data: T;
  protected wrapper: HTMLElement | null = null;
  protected isExpanded: boolean = false;
  protected imagePopover: HTMLElement | null = null;
  protected autocompleteInstance: AutocompleteInstance | null = null;

  // Abstract properties that subclasses must implement
  protected abstract blockType: string;
  protected abstract blockTitle: string;
  protected abstract primaryColor: string;
  protected abstract gradientStart: string;
  protected abstract gradientEnd: string;
  protected abstract autocompleteType: "place" | "hotel";

  // Abstract methods that subclasses must implement
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
    }
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

  // Calculate location bias for autocomplete based on other places in the day
  protected calculateLocationBias() {
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) return undefined;

    const dayPlaces: { lat: number; lng: number }[] = [];
    const allBlocks = editorElement.querySelectorAll(".ce-block");

    // Find all place blocks in the current day
    let currentDayFound = false;
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];

      // Check if this block contains a day block (reset for new day)
      if (block.querySelector(".day-block")) {
        currentDayFound = false;
        dayPlaces.length = 0; // Reset for new day
      }

      // Check if this block contains our place block
      if (block.contains(this.wrapper)) {
        currentDayFound = true;
      }

      // If we're in the current day, collect place coordinates
      if (currentDayFound || block.contains(this.wrapper)) {
        const placeBlock = block.querySelector(
          `.${this.blockType.toLowerCase()}-block`
        ) as HTMLElement;
        if (placeBlock && placeBlock !== this.wrapper) {
          const lat = parseFloat(placeBlock.dataset.lat || "0");
          const lng = parseFloat(placeBlock.dataset.lng || "0");
          if (lat && lng) {
            dayPlaces.push({ lat, lng });
          }
        }
      }
    }

    // If we have places in the day, calculate the center and radius
    if (dayPlaces.length > 0) {
      const centerLat =
        dayPlaces.reduce((sum, p) => sum + p.lat, 0) / dayPlaces.length;
      const centerLng =
        dayPlaces.reduce((sum, p) => sum + p.lng, 0) / dayPlaces.length;

      // Calculate radius as distance to furthest point + buffer
      let maxDistance = 0;
      dayPlaces.forEach((place) => {
        const distance =
          Math.sqrt(
            Math.pow(place.lat - centerLat, 2) +
              Math.pow(place.lng - centerLng, 2)
          ) * 111320; // Rough conversion to meters
        maxDistance = Math.max(maxDistance, distance);
      });

      return {
        lat: centerLat,
        lng: centerLng,
        radius: Math.max(maxDistance + 5000, 10000), // At least 10km radius
      };
    }

    return undefined;
  }

  // Handle autocomplete selection
  protected handleAutocompleteSelection(
    prediction: AutocompletePrediction,
    statusIndicator: HTMLElement
  ) {
    this.data.status = "loading";
    this.updateStatusIndicator(statusIndicator, "loading");

    // Extract place details from the prediction
    const placeDetails = (prediction as any).place_details;
    console.log("Place details:", placeDetails);
    console.log("Photos:", placeDetails?.photos);

    if (placeDetails) {
      // Use the detailed place information
      this.data = {
        ...this.data,
        placeId: prediction.place_id,
        name: placeDetails.name || prediction.structured_formatting.main_text,
        address: placeDetails.formatted_address || "",
        lat: placeDetails.geometry?.location?.lat() || 0,
        lng: placeDetails.geometry?.location?.lng() || 0,
        rating: placeDetails.rating || 0,
        photoReferences:
          placeDetails.photos
            ?.map((photo: any) => {
              console.log("Photo object:", photo);
              // Google Places API returns PlacePhoto objects with getUrl() method
              if (photo.getUrl) {
                return photo.getUrl({ maxWidth: 400 });
              }
              // Fallback for other formats
              return "";
            })
            .filter(Boolean) || [],
        description: placeDetails.editorial_summary?.overview || "",
        thumbnailUrl: placeDetails.photos?.[0]?.getUrl
          ? placeDetails.photos[0].getUrl({ maxWidth: 100 })
          : "",
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

    this.updateStatusIndicator(statusIndicator, "found");

    // Auto-collapse after successful selection
    setTimeout(() => {
      this.renderCollapsed(false);
    }, 500);
  }

  // Cleanup method to destroy autocomplete instance
  protected cleanupAutocomplete() {
    if (this.autocompleteInstance) {
      this.autocompleteInstance.destroy();
      this.autocompleteInstance = null;
    }
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
    this.renderCollapsed(shouldStartEditing);

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

    return this.wrapper;
  }

  protected isCurrentlyEditing(): boolean {
    return this.wrapper?.querySelector('input[data-editing="true"]') !== null;
  }

  protected calculatePlaceNumber(): number {
    // Find this place's position among all blocks of the same type within the same day
    const editorElement = this.wrapper?.closest(".codex-editor");
    if (!editorElement) return 1;

    const allBlocks = editorElement.querySelectorAll(".ce-block");
    let placeNumberInDay = 1;
    let foundCurrentPlace = false;

    // Find all blocks and track day/place progression
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];

      // Check if this block contains a day block
      if (block.querySelector(".day-block")) {
        placeNumberInDay = 1; // Reset place counter for new day
      }
      // Check if this block contains a block of the same type as this one
      else if (block.querySelector(`.${this.blockType.toLowerCase()}-block`)) {
        if (block.contains(this.wrapper)) {
          foundCurrentPlace = true;
          break;
        }
        placeNumberInDay++;
      }
    }

    console.log(
      `${
        this.blockType
      }: Calculated ${this.blockType.toLowerCase()} number ${placeNumberInDay} for ${
        this.data.name
      }`
    );
    return foundCurrentPlace ? placeNumberInDay : 1;
  }

  protected renderCollapsed(isEditing: boolean = false) {
    if (!this.wrapper) return;

    // Clean up existing autocomplete instance when switching modes
    if (!isEditing) {
      this.cleanupAutocomplete();
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

    // Block type badge
    const badge = document.createElement("div");
    badge.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      padding: 4px 10px;
      border-radius: 16px;
      font-weight: bold;
      font-size: 12px;
      margin-right: 12px;
      display: flex;
      align-items: center;
    `;
    badge.innerHTML = `${this.getBlockIcon()}${this.blockTitle}`;

    // Main content container - consistent structure
    const contentContainer = document.createElement("div");
    contentContainer.style.cssText =
      "display: flex; align-items: center; flex: 1; gap: 8px;";

    // Thumbnail (if available and confirmed)
    if (!isEditing && this.data.thumbnailUrl) {
      const thumbnail = document.createElement("img");
      thumbnail.src = this.data.thumbnailUrl;
      thumbnail.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 4px;
        object-fit: cover;
        flex-shrink: 0;
      `;
      contentContainer.appendChild(thumbnail);
    }

    // Name/Input container
    const nameContainer = document.createElement("div");
    nameContainer.style.cssText =
      "flex: 1; display: flex; align-items: center; position: relative;";

    if (isEditing) {
      // Editing mode: show input with autocomplete
      const inputContainer = document.createElement("div");
      inputContainer.style.cssText = `
        position: relative;
        width: 100%;
      `;

      const placeInput = document.createElement("input");
      placeInput.type = "text";
      placeInput.setAttribute("data-editing", "true");
      placeInput.value = this.data.name || "";
      placeInput.placeholder = this.getPlaceholder();
      placeInput.style.cssText = `
        width: 100%;
        background: white;
        border: 2px solid ${this.primaryColor};
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 14px;
        font-weight: 500;
        color: #065f46;
        outline: none;
        transition: border-color 0.2s;
      `;

      // Setup autocomplete with new module
      const locationBias = this.calculateLocationBias();

      this.autocompleteInstance = attachAutocomplete(placeInput, {
        type: this.autocompleteType,
        locationBias,
        onSelect: (prediction) => {
          this.handleAutocompleteSelection(prediction, statusIndicator);
        },
        onFreeText: (text) => {
          this.data.name = text;
          this.data.status = "free-text";
          this.updateStatusIndicator(statusIndicator, "free-text");
          this.renderCollapsed(false);
        },
        placeholder: this.getPlaceholder(),
        minLength: 2,
        maxResults: 6,
      });

      // Track input changes for our data
      placeInput.addEventListener("input", (e) => {
        this.data.name = (e.target as HTMLInputElement).value;
      });

      inputContainer.appendChild(placeInput);
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
      const placeName = document.createElement("span");
      placeName.style.cssText = `
        color: #065f46;
        font-weight: 500;
        font-size: 14px;
        cursor: pointer;
        transition: color 0.2s ease;
      `;
      placeName.textContent = this.data.name;

      // Add hover functionality for visual feedback
      placeName.addEventListener("mouseenter", (e) => {
        e.stopPropagation();
        placeName.style.color = "#059669";
      });

      placeName.addEventListener("mouseleave", (e) => {
        e.stopPropagation();
        placeName.style.color = "#065f46";
      });

      nameContainer.appendChild(placeName);
    } else {
      // Placeholder mode
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
    }

    contentContainer.appendChild(nameContainer);

    // Status indicator (consistent position)
    const statusIndicator = document.createElement("div");
    statusIndicator.style.cssText = `
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    `;

    if (isEditing) {
      this.updateStatusIndicator(statusIndicator, this.data.status || "idle");
    } else if (this.data.placeId && this.data.name) {
      // Show success checkmark for confirmed places
      statusIndicator.innerHTML = `
        <div style="
          width: 16px; 
          height: 16px; 
          background: ${this.primaryColor}; 
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: white; font-size: 10px; font-weight: bold;">✓</span>
        </div>
      `;
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
    }

    contentContainer.appendChild(statusIndicator);

    // Edit/Confirm button (consistent position)
    const actionButton = document.createElement("button");
    actionButton.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      border: none;
      padding: 6px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    `;

    if (isEditing) {
      // Show confirm button
      actionButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polyline points="20,6 9,17 4,12" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
      actionButton.title = `Confirm ${this.blockType.toLowerCase()}`;

      actionButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const input = nameContainer.querySelector(
          'input[data-editing="true"]'
        ) as HTMLInputElement;
        if (input) {
          const value = input.value || "";
          if (value.trim()) {
            this.data.name = value;
            const searchEvent = new Event("keydown");
            Object.defineProperty(searchEvent, "key", { value: "Enter" });
            input.dispatchEvent(searchEvent);
          }
        }
      });
    } else if (this.data.placeId && this.data.name) {
      // Show edit button
      actionButton.style.background = "none";
      actionButton.style.color = this.primaryColor;
      actionButton.style.padding = "2px";
      actionButton.style.width = "20px";
      actionButton.style.height = "20px";

      actionButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;
      actionButton.title = `Edit ${this.blockType.toLowerCase()}`;

      actionButton.addEventListener("mouseenter", () => {
        actionButton.style.backgroundColor = "#ecfdf5";
      });

      actionButton.addEventListener("mouseleave", () => {
        actionButton.style.backgroundColor = "transparent";
      });

      actionButton.addEventListener("click", (e) => {
        e.stopPropagation();
        this.renderCollapsed(true);
      });
    } else {
      // Hide button for placeholder state
      actionButton.style.display = "none";
    }

    actionButton.addEventListener("mouseenter", () => {
      if (actionButton.style.display !== "none") {
        actionButton.style.transform = "scale(1.05)";
      }
    });

    actionButton.addEventListener("mouseleave", () => {
      actionButton.style.transform = "scale(1)";
    });

    contentContainer.appendChild(actionButton);

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

      drivingTime.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 12V7a1 1 0 0 1 1-1h4l2-3h2l2 3h4a1 1 0 0 1 1 1v5" stroke="currentColor" stroke-width="2" fill="none"/>
          <circle cx="7" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/>
          <circle cx="17" cy="17" r="2" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        ${formattedDriving}
      `;
      contentContainer.appendChild(drivingTime);
    }

    // Expand arrow (only show if confirmed place)
    const rightContent = document.createElement("div");
    rightContent.style.cssText = "display: flex; align-items: center;";

    if (!isEditing && this.data.placeId && this.data.name) {
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
    leftContent.appendChild(badge);
    leftContent.appendChild(contentContainer);
    header.appendChild(leftContent);
    header.appendChild(rightContent);
    this.wrapper?.appendChild(header);
  }

  protected renderExpanded() {
    if (!this.wrapper) return;

    this.wrapper.innerHTML = "";
    this.wrapper.style.padding = "16px 20px";

    // Always show the found place interface when expanded
    if (this.data.placeId && this.data.name) {
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

    // Block badge
    const badge = document.createElement("div");
    badge.style.cssText = `
      background: ${this.primaryColor};
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 14px;
      margin-right: 12px;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
      display: flex;
      align-items: center;
    `;
    badge.innerHTML = `${this.getBlockIcon()}${this.blockTitle}`;

    const placeName = document.createElement("span");
    placeName.style.cssText = `
      color: #065f46;
      font-weight: 600;
      font-size: 16px;
    `;
    placeName.textContent = this.data.name || "";

    // Edit button (icon only)
    const editButton = document.createElement("button");
    editButton.style.cssText = `
      background: none;
      border: none;
      color: ${this.primaryColor};
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      margin-left: 12px;
      transition: background-color 0.2s;
    `;
    editButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" stroke-width="2"/>
      </svg>
    `;
    editButton.title = `Edit ${this.blockType.toLowerCase()}`;

    editButton.addEventListener("mouseenter", () => {
      editButton.style.backgroundColor = "#ecfdf5";
    });
    editButton.addEventListener("mouseleave", () => {
      editButton.style.backgroundColor = "transparent";
    });

    editButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.renderCollapsed(true);
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

    leftContent.appendChild(badge);
    leftContent.appendChild(placeName);
    leftContent.appendChild(editButton);
    header.appendChild(leftContent);
    header.appendChild(collapseArrow);

    header.addEventListener("click", (e) => {
      if (e.target !== editButton && !editButton.contains(e.target as Node)) {
        e.stopPropagation();
        this.toggle();
      }
    });

    // Images section - 4 smaller images in a 2x2 grid
    const imagesSection = document.createElement("div");
    imagesSection.style.cssText = `
      margin-bottom: 16px;
    `;

    if (this.data.photoReferences && this.data.photoReferences.length > 0) {
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
        image.src = photoRef;
        image.style.cssText = `
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.2s ease;
        `;

        // Add hover effect and image popup
        image.addEventListener("mouseenter", () => {
          image.style.transform = "scale(1.05)";
          this.showImagePopover(image, photoRef);
        });

        image.addEventListener("mouseleave", () => {
          image.style.transform = "scale(1)";
          this.hideImagePopover();
        });

        // Add loading placeholder
        image.addEventListener("error", () => {
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

    // Description section - Google Places API description
    if (this.data.description) {
      const descriptionContainer = document.createElement("div");
      descriptionContainer.style.cssText = `
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
        border: 1px solid #0ea5e9;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
      `;

      const descriptionLabel = document.createElement("h4");
      descriptionLabel.style.cssText = `
        color: #0c4a6e;
        font-size: 15px;
        font-weight: 700;
        margin: 0 0 10px 0;
        display: flex;
        align-items: center;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;
      descriptionLabel.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
          <path d="M9 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-4M9 11V9a3 3 0 1 1 6 0v2M9 11h6" stroke="currentColor" stroke-width="2"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        Google Places Description
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

      const sourceNote = document.createElement("div");
      sourceNote.style.cssText = `
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #bae6fd;
        font-size: 11px;
        color: #0369a1;
        text-align: right;
        font-weight: 500;
      `;
      sourceNote.textContent = "Source: Google Places API";

      descriptionContainer.appendChild(descriptionLabel);
      descriptionContainer.appendChild(description);
      descriptionContainer.appendChild(sourceNote);
      imagesSection.appendChild(descriptionContainer);
    }

    // Place details section
    const detailsSection = document.createElement("div");
    detailsSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    `;

    if (this.data.address) {
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

    if (this.data.rating) {
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
          ">
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
          ">
            <span style="color: white; font-size: 8px; font-weight: bold;">T</span>
          </div>
        `;
        break;
      case "error":
        indicator.innerHTML = `
          <div style="
            width: 16px; 
            height: 16px; 
            background: #ef4444; 
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <span style="color: white; font-size: 10px; font-weight: bold;">✗</span>
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
    };
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
    };
  }
}
