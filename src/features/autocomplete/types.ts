export interface AutocompleteLocationBias {
  lat: number;
  lng: number;
  radius: number; // radius in meters
}

export interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
  place_details?: {
    name: string;
    formatted_address: string;
    geometry?: google.maps.places.PlaceGeometry;
    rating?: number;
    photos?: google.maps.places.PlacePhoto[];
    editorial_summary?: any;
    types: string[];
  };
}

export interface AutocompleteOptions {
  type: "place" | "hotel";
  locationBias?: AutocompleteLocationBias;
  onSelect: (prediction: AutocompletePrediction) => void;
  onFreeText?: (text: string) => void;
  placeholder?: string;
  minLength?: number;
  maxResults?: number;
}

export interface AutocompleteInstance {
  destroy: () => void;
  updateLocationBias: (bias: AutocompleteLocationBias) => void;
  clear: () => void;
}

// Place type configuration
export interface PlaceTypeConfig {
  types: string[];
  label: string;
}

export const PLACE_TYPE_CONFIGS: Record<string, PlaceTypeConfig> = {
  place: {
    types: [],
    label: "Places",
  },
  hotel: {
    types: ["lodging"],
    label: "Hotels",
  },
};
