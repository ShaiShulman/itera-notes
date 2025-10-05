"use client";

import React from "react";
import Image from "next/image";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AddPlacePopupProps } from "./types";
import { getDayColor } from "../utils/colors";
import { getPlacePhotoUrl } from "@/features/editor/utils/photoUtils";

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

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const month = date.toLocaleDateString("en-US", { month: "short" });
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return "";
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-t-xl shadow-xl border-t border-slate-200 flex flex-col animate-slide-up" style={{ maxHeight: "55vh" }}>
      {/* Compact Header with Image */}
      <div className="px-3 py-2.5 border-b border-slate-200 flex-shrink-0">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-slate-600">Loading place details...</span>
          </div>
        ) : placeData ? (
          <div className="flex gap-3">
            {/* Place Image */}
            {placeData.thumbnailUrl && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                <Image
                  src={getPlacePhotoUrl(placeData.thumbnailUrl, 150)}
                  alt={placeData.name}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}

            {/* Place Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                    {placeData.name}
                  </h3>
                  {placeData.rating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-xs text-slate-600">{placeData.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-slate-100 rounded flex-shrink-0"
                  title="Close"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Address */}
              {placeData.address && (
                <p className="text-xs text-slate-600 mt-1 line-clamp-1" title={placeData.address}>
                  {placeData.address}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">{placeName}</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded flex-shrink-0"
              title="Close"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* "Add to Day:" Label */}
      <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
        <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Add to Day:
        </h4>
      </div>

      {/* Compact Day List */}
      <div className="flex-1 overflow-y-auto scroll-smooth px-3 py-2">
        {!isLoading && currentItinerary && currentItinerary.days.length > 0 ? (
          <div className="space-y-1.5">
            {currentItinerary.days.map((day, index) => {
              const dayColor = getDayColor(index);
              return (
                <button
                  key={day.dayNumber}
                  onClick={() => {
                    if (placeData) {
                      onAddToDay(day.dayNumber, placeData);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-md transition-all border disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: dayColor,
                    backgroundColor: `${dayColor}08`,
                  }}
                  onMouseEnter={(e) => {
                    if (placeData) {
                      e.currentTarget.style.backgroundColor = `${dayColor}18`;
                      e.currentTarget.style.transform = "translateX(2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${dayColor}08`;
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                  disabled={!placeData}
                >
                  <div className="flex items-center gap-2">
                    {/* Compact Colored Badge */}
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0"
                      style={{ backgroundColor: dayColor }}
                    >
                      {day.dayNumber}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {day.title || `Day ${day.dayNumber}`}
                        </span>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          {formatDate(day.date)}
                        </span>
                      </div>
                    </div>

                    {/* Add Icon */}
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !isLoading ? (
          <div className="py-6 text-center text-sm text-slate-500">
            No days in itinerary
          </div>
        ) : null}
      </div>
    </div>
  );
}
