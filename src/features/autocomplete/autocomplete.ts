import {
  AutocompleteOptions,
  AutocompleteInstance,
  AutocompletePrediction,
  AutocompleteLocationBias,
  PLACE_TYPE_CONFIGS,
} from "./types";
import { getIconForPlaceType, getPlaceTypeName } from "./icons";
import { getPlaceDetailsAction } from "@/features/editor/actions/places";

export function attachAutocomplete(
  input: HTMLInputElement,
  options: AutocompleteOptions
): AutocompleteInstance {
  // Validate environment
  if (typeof window === "undefined" || !window.google?.maps?.places) {
    throw new Error("Google Maps Places API is not available");
  }

  // State
  let autocompleteService: google.maps.places.AutocompleteService;
  let placesService: google.maps.places.PlacesService;
  let dropdown: HTMLElement | null = null;
  let currentPredictions: AutocompletePrediction[] = [];
  let searchTimeout: NodeJS.Timeout;
  let isDestroyed = false;
  let currentLocationBias = options.locationBias;

  // Initialize services
  try {
    autocompleteService = new google.maps.places.AutocompleteService();
    // Create a dummy div for PlacesService (required by Google Maps API)
    const dummyDiv = document.createElement("div");
    placesService = new google.maps.places.PlacesService(dummyDiv);
  } catch (error) {
    console.error("Failed to initialize Google Places services:", error);
    throw new Error("Failed to initialize Google Places services");
  }

  // Configuration
  const config = {
    minLength: options.minLength || 2,
    maxResults: options.maxResults || 5,
    placeholder: options.placeholder || "Enter location...",
    searchDebounceMs: 300,
  };

  // Apply initial configuration
  if (config.placeholder) {
    input.placeholder = config.placeholder;
  }

  // Create dropdown element
  function createDropdown(): HTMLElement {
    const dropdown = document.createElement("div");
    dropdown.className = "autocomplete-dropdown";
    dropdown.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 2px solid #10b981;
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 320px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Position dropdown relative to input
    const inputContainer = input.parentElement;
    if (inputContainer && inputContainer.style.position === "relative") {
      inputContainer.appendChild(dropdown);
    } else {
      // Create wrapper if needed
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      input.parentNode?.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      wrapper.appendChild(dropdown);
    }

    return dropdown;
  }

  // Show dropdown with predictions
  function showDropdown(predictions: AutocompletePrediction[]) {
    if (!dropdown) {
      dropdown = createDropdown();
    }

    dropdown.innerHTML = "";
    currentPredictions = predictions;

    // Add each prediction as a dropdown item
    predictions.forEach((prediction, index) => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.dataset.index = index.toString();
      item.style.cssText = `
        padding: 12px 16px;
        border-bottom: 1px solid #f3f4f6;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        line-height: 1.5;
      `;

      // Create icon container
      const iconContainer = document.createElement("div");
      iconContainer.style.cssText = `
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      iconContainer.innerHTML = getIconForPlaceType(prediction.types);

      // Create content container
      const contentContainer = document.createElement("div");
      contentContainer.style.cssText = `
        flex: 1;
        min-width: 0;
      `;

      // Main text (place name)
      const mainText = document.createElement("div");
      mainText.style.cssText = `
        font-weight: 600;
        color: #065f46;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      `;
      mainText.textContent = prediction.structured_formatting.main_text;

      // Address text (secondary text as address)
      const addressText = document.createElement("div");
      addressText.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 400;
      `;
      addressText.textContent =
        prediction.structured_formatting.secondary_text || "Address not available";

      contentContainer.appendChild(mainText);
      contentContainer.appendChild(addressText);

      // Type badge
      const typeBadge = document.createElement("div");
      typeBadge.style.cssText = `
        background: #f0f9ff;
        color: #0369a1;
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;
      typeBadge.textContent = getPlaceTypeName(prediction.types);

      item.appendChild(iconContainer);
      item.appendChild(contentContainer);
      item.appendChild(typeBadge);

      // Add hover effects
      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "#f0f9ff";
        // Remove selected class from other items
        dropdown?.querySelectorAll(".autocomplete-item").forEach((el) => {
          el.classList.remove("selected");
        });
        item.classList.add("selected");
      });

      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
      });

      // Handle click selection
      item.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectPrediction(prediction);
      });

      // Also handle mousedown to ensure selection works
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      dropdown?.appendChild(item);
    });

    // Add "Use as free text" option if enabled
    if (options.onFreeText) {
      const freeTextItem = document.createElement("div");
      freeTextItem.className = "autocomplete-item free-text";
      freeTextItem.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        transition: background-color 0.2s;
        border-top: 1px solid #e5e7eb;
        font-style: italic;
        color: #6b7280;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      `;

      const freeTextIcon = document.createElement("div");
      freeTextIcon.style.cssText = `
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #9ca3af;
      `;
      freeTextIcon.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2"/>
        </svg>
      `;

      const freeTextLabel = document.createElement("span");
      freeTextLabel.textContent = `Use "${input.value}" as free text`;

      freeTextItem.appendChild(freeTextIcon);
      freeTextItem.appendChild(freeTextLabel);

      freeTextItem.addEventListener("mouseenter", () => {
        freeTextItem.style.backgroundColor = "#f9fafb";
      });

      freeTextItem.addEventListener("mouseleave", () => {
        freeTextItem.style.backgroundColor = "transparent";
      });

      freeTextItem.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (options.onFreeText) {
          options.onFreeText(input.value);
        }
        hideDropdown();
      });

      // Also handle mousedown for free text item
      freeTextItem.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      dropdown.appendChild(freeTextItem);
    }

    dropdown.style.display = "block";
  }

  // Hide dropdown
  function hideDropdown() {
    if (dropdown) {
      dropdown.style.display = "none";
      dropdown.innerHTML = "";
    }
    currentPredictions = [];
  }

  // Navigate dropdown with keyboard
  function navigateDropdown(direction: "up" | "down") {
    if (!dropdown) return;

    const items = dropdown.querySelectorAll(".autocomplete-item");
    const currentSelected = dropdown.querySelector(
      ".autocomplete-item.selected"
    );

    let newIndex = -1;

    if (currentSelected) {
      const currentIndex = Array.from(items).indexOf(currentSelected);
      newIndex = direction === "down" ? currentIndex + 1 : currentIndex - 1;
    } else {
      newIndex = direction === "down" ? 0 : items.length - 1;
    }

    // Wrap around
    if (newIndex < 0) newIndex = items.length - 1;
    if (newIndex >= items.length) newIndex = 0;

    // Remove previous selection
    items.forEach((item) => item.classList.remove("selected"));

    // Add new selection
    if (items[newIndex]) {
      items[newIndex].classList.add("selected");
      (items[newIndex] as HTMLElement).style.backgroundColor = "#f0f9ff";
    }
  }

  // Select prediction and get details
  async function selectPrediction(prediction: AutocompletePrediction) {
    hideDropdown();

    try {
      // Use cached server action instead of direct API call
      const placeDetails = await getPlaceDetailsAction(prediction.place_id);
      
      if (placeDetails) {
        const enrichedPrediction: AutocompletePrediction = {
          ...prediction,
          // Add additional details from server response
          place_details: {
            name: placeDetails.name || prediction.structured_formatting.main_text,
            formatted_address: placeDetails.formatted_address || "",
            geometry: placeDetails.geometry,
            rating: placeDetails.rating,
            photos: placeDetails.photos,
            editorial_summary: placeDetails.editorial_summary,
            types: placeDetails.types || prediction.types,
          },
        };

        // Update input value
        input.value = placeDetails.name || prediction.structured_formatting.main_text;

        // Call selection callback
        options.onSelect(enrichedPrediction);
      } else {
        console.warn("No place details found for:", prediction.place_id);
        // Fallback to basic prediction
        input.value = prediction.structured_formatting.main_text;
        options.onSelect(prediction);
      }
    } catch (error) {
      console.error("Error getting place details:", error);
      // Fallback to basic prediction
      input.value = prediction.structured_formatting.main_text;
      options.onSelect(prediction);
    }
  }

  // Search for predictions
  async function searchPredictions(query: string) {
    if (!autocompleteService || query.length < config.minLength) {
      hideDropdown();
      return;
    }

    try {
      const request: google.maps.places.AutocompletionRequest = {
        input: query,
        types: PLACE_TYPE_CONFIGS[options.type].types,
      };

      // Add location bias if provided
      if (currentLocationBias) {
        request.location = new google.maps.LatLng(
          currentLocationBias.lat,
          currentLocationBias.lng
        );
        request.radius = currentLocationBias.radius;
      }

      autocompleteService.getPlacePredictions(
        request,
        (predictions, status) => {
          if (isDestroyed) return;

          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            predictions
          ) {
            const limitedPredictions = predictions
              .slice(0, config.maxResults)
              .map((p) => ({
                place_id: p.place_id,
                description: p.description,
                structured_formatting: {
                  main_text:
                    p.structured_formatting?.main_text || p.description,
                  secondary_text: p.structured_formatting?.secondary_text || "",
                },
                types: p.types || [],
              }));

            showDropdown(limitedPredictions);
          } else {
            hideDropdown();
          }
        }
      );
    } catch (error) {
      console.error("Autocomplete search error:", error);
      hideDropdown();
    }
  }

  // Event handlers
  const handleInput = (e: Event) => {
    const inputValue = (e.target as HTMLInputElement).value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (inputValue.length < config.minLength) {
      hideDropdown();
      return;
    }

    searchTimeout = setTimeout(() => {
      searchPredictions(inputValue);
    }, config.searchDebounceMs);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isDestroyed) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        navigateDropdown("down");
        break;
      case "ArrowUp":
        e.preventDefault();
        navigateDropdown("up");
        break;
      case "Enter":
        e.preventDefault();
        const selectedItem = dropdown?.querySelector(
          ".autocomplete-item.selected"
        ) as HTMLElement;
        if (selectedItem) {
          const index = parseInt(selectedItem.dataset.index || "0");
          if (selectedItem.classList.contains("free-text")) {
            if (options.onFreeText) {
              options.onFreeText(input.value);
            }
            hideDropdown();
          } else if (currentPredictions[index]) {
            selectPrediction(currentPredictions[index]);
          }
        } else if (input.value.trim()) {
          // No item selected but there's text - try search first
          const query = input.value.trim();
          if (options.onFreeTextSearch) {
            // Use the new search callback
            options.onFreeTextSearch(query);
            hideDropdown();
          } else if (options.onFreeText) {
            // Fallback to old behavior
            options.onFreeText(query);
            hideDropdown();
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        hideDropdown();
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding dropdown to allow for clicks
    setTimeout(() => {
      if (!isDestroyed) {
        hideDropdown();
      }
    }, 300);
  };

  const handleFocus = () => {
    if (input.value.length >= config.minLength) {
      searchPredictions(input.value);
    }
  };

  // Attach event listeners
  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeyDown);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("focus", handleFocus);

  // Return instance with control methods
  return {
    destroy: () => {
      isDestroyed = true;

      // Clear timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Remove event listeners
      input.removeEventListener("input", handleInput);
      input.removeEventListener("keydown", handleKeyDown);
      input.removeEventListener("blur", handleBlur);
      input.removeEventListener("focus", handleFocus);

      // Remove dropdown
      if (dropdown) {
        dropdown.remove();
        dropdown = null;
      }

      // Clear state
      currentPredictions = [];
    },

    updateLocationBias: (bias: AutocompleteLocationBias) => {
      currentLocationBias = bias;
    },

    clear: () => {
      input.value = "";
      hideDropdown();
    },
  };
}

// Export types for convenience
export type {
  AutocompleteOptions,
  AutocompleteInstance,
  AutocompletePrediction,
} from "./types";
