"use client";

import React from "react";
import Image from "next/image";
import { useItinerary } from "@/contexts/ItineraryContext";
import { AddPlacePopupProps } from "./types";
import { getDayColor } from "../utils/colors";
import { getPlacePhotoUrl } from "@/features/editor/utils/photoUtils";
import { IconLoader, IconPaths } from "@/assets/icons/iconLoader";

// Icon components
const BanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
  </svg>
);

const FlagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
  </svg>
);

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
    <div className="absolute z-20 bg-white rounded-lg shadow-lg border border-slate-200 min-w-[320px] max-w-[380px]">
      {/* Place Information Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
              <h3 className="text-sm font-semibold text-slate-800">
                Add to Itinerary
              </h3>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-slate-600">
                  Loading place details...
                </span>
              </div>
            ) : placeData ? (
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-slate-900 leading-tight">
                  {placeData.name}
                </h4>
                {placeData.address && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {placeData.address}
                  </p>
                )}
                {placeData.rating && (
                  <div className="flex items-center gap-1">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-3 h-3 ${
                            star <= Math.floor(placeData.rating || 0)
                              ? "text-yellow-400"
                              : "text-slate-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs text-slate-600 ml-1">
                      {placeData.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <h4 className="text-base font-semibold text-slate-900">
                {placeName}
              </h4>
            )}
          </div>

          {/* Place Image */}
          {placeData?.thumbnailUrl && (
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

          {/* Status Icons */}
          <div className="flex gap-1 flex-shrink-0">
            {/* Hide in Map Icon */}
            {(placeData as any)?.hideInMap && (
              <div className="w-4 h-4 text-red-600 flex-shrink-0" title="Hidden from map">
                <BanIcon />
              </div>
            )}
            
            {/* Day Finish Icon */}
            {(placeData as any)?.isDayFinish && (
              <div className="w-4 h-4 text-green-600 flex-shrink-0" title="Day finish location">
                <FlagIcon />
              </div>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full flex-shrink-0 ml-2"
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
      </div>

      {/* Day Selection */}
      <div className="p-3">
        <h5 className="text-xs font-medium text-slate-700 mb-3 uppercase tracking-wide">
          Select Day
        </h5>

        {!isLoading && currentItinerary && currentItinerary.days.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
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
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100 hover:border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!placeData}
                >
                  <div className="flex items-center gap-3">
                    {/* Colored Bullet */}
                    <div
                      className={`bg-[${dayColor}] w-3 h-3 rounded-full flex-shrink-0`}
                      aria-label={`Day color: ${dayColor}`}
                    ></div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">
                          Day {day.dayNumber}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">
                        {day.title}
                      </div>
                    </div>

                    {/* Add Icon */}
                    <div className="flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !isLoading ? (
          <div className="p-4 text-center text-sm text-slate-500">
            No days available in your itinerary
          </div>
        ) : null}
      </div>
    </div>
  );
}
