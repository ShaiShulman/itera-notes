"use client";

import React from "react";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AddPlacePopupProps } from "./types";

export function AddPlacePopup({
  isOpen,
  position,
  placeName,
  placeData,
  isLoading,
  onClose,
  onAddToDay,
}: AddPlacePopupProps) {
  const { state } = useItinerary();
  const { currentItinerary } = state;

  if (!isOpen || !position) return null;

  return (
    <div className="absolute z-20 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[200px] max-w-[280px]">
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Add to Date</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full"
            title="Close"
          >
            <svg
              className="w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1 truncate" title={placeName}>
          {placeName}
        </p>
      </div>

      <div className="p-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-slate-600">
              Loading place details...
            </span>
          </div>
        ) : currentItinerary && currentItinerary.days.length > 0 ? (
          <div className="space-y-1">
            {currentItinerary.days.map((day) => (
              <button
                key={day.dayNumber}
                onClick={() => {
                  if (placeData) {
                    onAddToDay(day.dayNumber, placeData);
                  }
                }}
                className="w-full text-left p-2 rounded hover:bg-slate-50 transition-colors"
                disabled={!placeData}
              >
                <div className="text-sm font-medium text-slate-800">
                  Day {day.dayNumber}
                </div>
                <div className="text-xs text-slate-600">
                  {new Date(day.date).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {day.title}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center text-sm text-slate-500">
            No days available
          </div>
        )}
      </div>
    </div>
  );
}
