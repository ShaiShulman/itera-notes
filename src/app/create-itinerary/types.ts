import { z } from "zod";

// Zod schema for new itinerary form validation
export const newItinerarySchema = z
  .object({
    destination: z
      .string()
      .min(1, "Destination is required")
      .max(100, "Destination is too long"),
    startDate: z
      .string()
      .min(1, "Start date is required")
      .refine((date: string) => {
        const startDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return startDate >= today;
      }, "Start date must be today or later"),
    endDate: z.string().min(1, "End date is required"),
    interests: z
      .array(z.string())
      .min(1, "At least one interest is required")
      .max(15, "Too many interests selected"),
    travelStyle: z.enum(
      [
        "budget",
        "mid-range",
        "luxury",
        "backpacker",
        "family",
        "business",
        "adventure",
        "romantic",
      ],
      {
        errorMap: () => ({ message: "Please select a travel style" }),
      }
    ),
    additionalNotes: z
      .string()
      .max(1000, "Additional notes are too long")
      .optional(),
  })
  .refine(
    (data: { startDate: string; endDate: string }) => {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return endDate >= startDate && diffDays <= 10;
    },
    {
      message:
        "End date must be after start date and trip cannot exceed 10 days",
      path: ["endDate"],
    }
  );

// TypeScript type derived from schema
export type NewItineraryForm = z.infer<typeof newItinerarySchema>;

// Predefined interests list
export const DEFAULT_INTERESTS = [
  "Museums & Art",
  "Food & Dining",
  "Nature & Parks",
  "History & Culture",
  "Shopping",
  "Nightlife",
  "Architecture",
  "Adventure Sports",
  "Photography",
  "Music & Events",
  "Local Markets",
  "Religious Sites",
];

// Travel style options with descriptions
export const TRAVEL_STYLES = [
  {
    value: "budget",
    label: "Budget-friendly",
    description: "Affordable options, local experiences",
  },
  {
    value: "mid-range",
    label: "Mid-range",
    description: "Balanced comfort and value",
  },
  {
    value: "luxury",
    label: "Luxury",
    description: "Premium experiences and accommodations",
  },
  {
    value: "backpacker",
    label: "Backpacker",
    description: "Independent, adventurous travel",
  },
  {
    value: "family",
    label: "Family-friendly",
    description: "Suitable for all ages",
  },
  {
    value: "business",
    label: "Business",
    description: "Professional and efficient",
  },
  {
    value: "adventure",
    label: "Adventure",
    description: "Outdoor activities and thrills",
  },
  {
    value: "romantic",
    label: "Romantic",
    description: "Intimate and couple-focused",
  },
] as const;
