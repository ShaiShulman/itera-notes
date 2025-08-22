"use client";

import React from "react";
import { getDayColor } from "../../map/utils/colors";
import { formatDrivingTimeAndDistance } from "../../editor/utils/formatting";
import { formatDate } from "@/utils/timeUtils";
import { cleanString } from "@/utils/strings";

export interface StoryDayData {
  dayNumber: number;
  title: string;
  date?: string;
  region?: string;
  totalDrivingTime: number; // in minutes
  totalDrivingDistance: number; // in meters
  placeCount: number;
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

          {/* Driving time */}
          {day.totalDrivingTime > 0 && (
            <div className="flex items-center gap-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.62,13.08a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3,1.15,1.15,0,0,0,.33-.21,1.15,1.15,0,0,0,.21-.33A.84.84,0,0,0,8,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,6.62,13.08Zm13.14-4L18.4,5.05a3,3,0,0,0-2.84-2H8.44A3,3,0,0,0,5.6,5.05L4.24,9.11A3,3,0,0,0,2,12v4a3,3,0,0,0,2,2.82V20a1,1,0,0,0,2,0V19H18v1a1,1,0,0,0,2,0V18.82A3,3,0,0,0,22,16V12A3,3,0,0,0,19.76,9.11ZM7.49,5.68A1,1,0,0,1,8.44,5h7.12a1,1,0,0,1,1,.68L17.61,9H6.39ZM20,16a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V12a1,1,0,0,1,1-1H19a1,1,0,0,1,1,1Zm-3.38-2.92a.9.9,0,0,0-.54.54,1,1,0,0,0,1.3,1.3.9.9,0,0,0,.54-.54A.84.84,0,0,0,18,14a1.05,1.05,0,0,0-.29-.71A1,1,0,0,0,16.62,13.08ZM13,13H11a1,1,0,0,0,0,2h2a1,1,0,0,0,0-2Z"
                  fill="currentColor"
                />
              </svg>
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
