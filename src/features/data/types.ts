import { EditorData } from "@/features/editor/types";
import { DirectionsData } from "@/features/directions/types";

export interface ItineraryRecord {
  id: string;
  userId: string;
  title?: string | null;
  editorData: string; // JSON stringified EditorData
  version: string;
  hash: string;
  
  // Form metadata fields
  destination: string;
  startDate: Date;
  endDate: Date;
  interests: string[]; // JSON array of selected interests
  travelStyle: string;
  additionalNotes?: string | null;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ItineraryDirectionsRecord {
  id: string;
  itineraryId: string;
  dayIndex: number;
  color: string;
  directionsResult: string; // JSON stringified DirectionsResponse
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveItineraryRequest {
  id?: string; // undefined for new itinerary
  title?: string;
  editorData: EditorData;
  directions?: DirectionsData[];
  
  // Form metadata fields
  destination?: string;
  startDate?: Date;
  endDate?: Date;
  interests?: string[];
  travelStyle?: string;
  additionalNotes?: string;
}

export interface SaveItineraryResponse {
  id: string;
  success: boolean;
  error?: string;
  conflictResolved?: boolean;
  unchanged?: boolean; // True if content was identical and save was skipped
}

export interface LoadItineraryResponse {
  success: boolean;
  data?: {
    id: string;
    title?: string;
    editorData: EditorData;
    directions: DirectionsData[];
    lastUpdated: Date;
    
    // Form metadata fields
    destination?: string;
    startDate?: Date;
    endDate?: Date;
    interests?: string[];
    travelStyle?: string;
    additionalNotes?: string;
  };
  error?: string;
}

export interface ItinerarySummary {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  editorData?: EditorData; // Include editor data for extracting stats and images
  
  // Form metadata fields
  destination?: string;
  startDate?: Date;
  endDate?: Date;
  interests?: string[];
  travelStyle?: string;
  additionalNotes?: string;
}

export interface ListItinerariesResponse {
  success: boolean;
  data?: ItinerarySummary[];
  error?: string;
}

export interface DeleteItineraryResponse {
  success: boolean;
  error?: string;
}