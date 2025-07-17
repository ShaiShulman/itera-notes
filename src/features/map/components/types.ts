import { PlaceLocation } from "@/services/openai/itinerary";

// Interface for popup state
export interface PlacePopupState {
  isOpen: boolean;
  position: { lat: number; lng: number } | null;
  placeName: string;
  placeData: PlaceLocation | null;
  isLoading: boolean;
}

// Props interface for AddPlacePopup component
export interface AddPlacePopupProps {
  isOpen: boolean;
  position: { lat: number; lng: number } | null;
  placeName: string;
  placeData: PlaceLocation | null;
  isLoading: boolean;
  onClose: () => void;
  onAddToDay: (dayNumber: number, place: PlaceLocation) => void;
}
