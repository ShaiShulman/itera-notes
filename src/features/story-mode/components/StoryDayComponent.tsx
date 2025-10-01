"use client";

import React from "react";
import Image from "next/image";
import { getDayColor } from "../../map/utils/colors";
import { formatDrivingTimeAndDistance } from "../../editor/utils/formatting";
import { formatDate } from "@/utils/timeUtils";
import { cleanString } from "@/utils/strings";
import { TransportMode } from "@/types/transport";
import { getTransportIconPath } from "@/utils/transportUtils";

export interface StoryDayData {
  dayNumber: number;
  title: string;
  date?: string;
  region?: string;
  totalDrivingTime: number; // in minutes
  totalDrivingDistance: number; // in meters
  placeCount: number;
  transportMode?: TransportMode;
}

export interface StoryDayComponentProps {
  day: StoryDayData;
  onClick?: () => void;
  onHover?: (isHovering: boolean, dayNumber: number) => void;
}

export const StoryDayComponent: React.FC<StoryDayComponentProps> = ({
  day,
  onClick,
  onHover,
}) => {
  const dayColor = getDayColor(day.dayNumber - 1);
  const formattedDriving = formatDrivingTimeAndDistance(
    day.totalDrivingTime,
    day.totalDrivingDistance
  );

  const handleMouseEnter = () => {
    onHover?.(true, day.dayNumber);
  };

  const handleMouseLeave = () => {
    onHover?.(false, day.dayNumber);
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 mb-6 bg-white border-2 rounded-xl shadow-sm transition-all duration-200 border-[var(--day-color)] ${
        onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : ""
      }`}
      style={{ "--day-color": dayColor } as React.CSSProperties}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Day number circle */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full text-white font-bold text-lg shadow-md flex-shrink-0 bg-[var(--day-color)]">
        {day.dayNumber}
      </div>

      {/* Day content */}
      <div className="flex-1 min-w-0">
        {/* Title and date */}
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className="text-lg font-semibold text-gray-800 truncate">
            {cleanString(day.title) || `Day ${day.dayNumber}`}
          </h3>
          {day.date && (
            <span className="text-sm text-gray-500 font-medium flex-shrink-0">
              {formatDate(day.date)}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          {/* Place count */}
          <div className="flex items-center gap-1">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
            <span>
              {day.placeCount} {day.placeCount === 1 ? "place" : "places"}
            </span>
          </div>

          {/* Driving time with transport mode icon */}
          {day.totalDrivingTime > 0 && (
            <div className="flex items-center gap-1">
              <Image
                src={getTransportIconPath(day.transportMode || "driving")}
                alt={`${day.transportMode || "driving"} icon`}
                width={18}
                height={18}
                style={{ display: "inline" }}
              />
              <span>{formattedDriving}</span>
            </div>
          )}
        </div>
      </div>

      {/* Arrow indicator if clickable */}
      {onClick && (
        <div className="text-gray-400 flex-shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="9,18 15,12 9,6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default StoryDayComponent;
