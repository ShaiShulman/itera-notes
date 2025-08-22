"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BasePlaceBlockData } from "../../editor/types";
import { formatDrivingTimeAndDistance } from "../../editor/utils/formatting";
import { cleanString } from "@/utils/strings";
import { ImageViewer } from "@/components/ui/ImageViewer";

export interface PlaceDetailsPopupProps {
  placeData: BasePlaceBlockData;
  isVisible: boolean;
  triggerElement?: HTMLElement;
  onClose?: () => void;
  previousPlaceName?: string; // Name of the previous place for driving time context
}

export const PlaceDetailsPopup: React.FC<PlaceDetailsPopupProps> = ({
  placeData,
  isVisible,
  triggerElement,
  onClose,
  previousPlaceName,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Calculate position based on trigger element
  useEffect(() => {
    if (isVisible && triggerElement && popupRef.current) {
      const triggerRect = triggerElement.getBoundingClientRect();
      const popupRect = popupRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = triggerRect.left + triggerRect.width / 2 - popupRect.width / 2;
      let y = triggerRect.bottom + 8; // 8px below the trigger

      // Adjust if popup would go off screen
      if (x + popupRect.width > viewportWidth - 16) {
        x = viewportWidth - popupRect.width - 16;
      }
      if (x < 16) {
        x = 16;
      }

      // If popup would go below viewport, show it above the trigger
      if (y + popupRect.height > viewportHeight - 16) {
        y = triggerRect.top - popupRect.height - 8;
      }

      setPosition({ x, y });
    }
  }, [isVisible, triggerElement]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        !triggerElement?.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isVisible, triggerElement, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isVisible, onClose]);

  if (!isVisible || !placeData.name) {
    return null;
  }

  const popup = (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white border border-emerald-200 rounded-lg shadow-lg p-4 max-w-sm animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-emerald-800 text-lg truncate pr-2">
          {placeData.name}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>

      {/* Images grid - show up to 4 images */}
      {placeData.placeId &&
        placeData.photoReferences &&
        placeData.photoReferences.length > 0 && (
          <div className="mb-3">
            <div className="grid grid-cols-4 gap-1">
              {placeData.photoReferences.slice(0, 4).map((photoRef, index) => (
                <ImageViewer
                  key={index}
                  photoRef={photoRef}
                  placeName={placeData.name || ""}
                  width="80px"
                  height="80px"
                />
              ))}
            </div>
          </div>
        )}

      {/* Description */}
      {placeData.description && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-900 text-sm italic leading-relaxed">
            {cleanString(placeData.description)}
          </p>
        </div>
      )}

      {/* User Notes */}
      {placeData.notes && placeData.notes.trim() && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-yellow-600 mt-0.5 flex-shrink-0"
            >
              <path
                d="M9 11H15M9 15H15M17 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V5C19 3.89543 18.1046 3 17 3Z"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <div>
              <h4 className="text-yellow-800 text-xs font-semibold mb-1">
                Your Notes
              </h4>
              <p className="text-yellow-800 text-sm leading-relaxed whitespace-pre-wrap">
                {placeData.notes}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details */}
      <div className="space-y-2">
        {/* Address */}
        {placeData.address && (
          <div className="flex items-start gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-gray-500 mt-0.5 flex-shrink-0"
            >
              <path
                d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle
                cx="12"
                cy="10"
                r="3"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <span className="text-gray-700 text-sm leading-tight">
              {placeData.address}
            </span>
          </div>
        )}

        {/* Rating */}
        {placeData.rating && placeData.rating > 0 && (
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              className="text-yellow-400 flex-shrink-0"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-gray-700 text-sm font-medium">
              {placeData.rating}/5
            </span>
          </div>
        )}

        {/* Driving Time */}
        {placeData.drivingTimeFromPrevious &&
          placeData.drivingTimeFromPrevious > 0 &&
          !placeData.hideInMap && (
            <div className="flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-gray-500 flex-shrink-0"
              >
                <path
                  d="M6.62,13.08a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3,1.15,1.15,0,0,0,.33-.21,1.15,1.15,0,0,0,.21-.33A.84.84,0,0,0,8,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,6.62,13.08Zm13.14-4L18.4,5.05a3,3,0,0,0-2.84-2H8.44A3,3,0,0,0,5.6,5.05L4.24,9.11A3,3,0,0,0,2,12v4a3,3,0,0,0,2,2.82V20a1,1,0,0,0,2,0V19H18v1a1,1,0,0,0,2,0V18.82A3,3,0,0,0,22,16V12A3,3,0,0,0,19.76,9.11ZM7.49,5.68A1,1,0,0,1,8.44,5h7.12a1,1,0,0,1,1,.68L17.61,9H6.39ZM20,16a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V12a1,1,0,0,1,1-1H19a1,1,0,0,1,1,1Zm-3.38-2.92a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3.9.9,0,0,0,.54-.54A.84.84,0,0,0,18,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,16.62,13.08ZM13,13H11a1,1,0,0,0,0,2h2a1,1,0,0,0,0-2Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-gray-700 text-sm">
                {formatDrivingTimeAndDistance(
                  placeData.drivingTimeFromPrevious,
                  placeData.drivingDistanceFromPrevious || 0
                )}
                {previousPlaceName && (
                  <span className="text-gray-500">
                    {" "}
                    from {previousPlaceName}
                  </span>
                )}
              </span>
            </div>
          )}

        {/* Status indicator for free text or not found */}
        {(placeData.status === "free-text" ||
          placeData.status === "not-found") && (
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                placeData.status === "free-text" ? "bg-gray-400" : "bg-red-400"
              }`}
            />
            <span className="text-gray-600 text-xs">
              {placeData.status === "free-text"
                ? "Custom name"
                : "Location not found"}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
};

export default PlaceDetailsPopup;
