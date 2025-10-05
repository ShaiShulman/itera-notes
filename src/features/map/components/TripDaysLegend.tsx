"use client";

import { useState } from "react";
import { getDayColor } from "../utils/colors";

interface Day {
  index: number;
  title: string;
  date?: string;
}

interface TripDaysLegendProps {
  days: Day[];
  visibleDays: Set<number>;
  onVisibilityChange: (visibleDays: Set<number>) => void;
}

export function TripDaysLegend({
  days,
  visibleDays,
  onVisibilityChange,
}: TripDaysLegendProps) {
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);

  const toggleDay = (dayIndex: number) => {
    const newVisibleDays = new Set(visibleDays);
    if (newVisibleDays.has(dayIndex)) {
      newVisibleDays.delete(dayIndex);
    } else {
      newVisibleDays.add(dayIndex);
    }
    onVisibilityChange(newVisibleDays);
  };

  const showAllDays = () => {
    const allDays = new Set(days.map((_, idx) => idx));
    onVisibilityChange(allDays);
  };

  const hideAllDays = () => {
    onVisibilityChange(new Set());
  };

  if (days.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border w-[280px]">
      {/* Compact Header with All Controls */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-700">
          Days ({days.length})
        </span>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={showAllDays}
            className="px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded"
            title="Show all days"
          >
            All
          </button>
          <button
            onClick={hideAllDays}
            className="px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded"
            title="Hide all days"
          >
            None
          </button>
          <button
            onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
            className="p-0.5 hover:bg-slate-100 rounded"
            title={isLegendCollapsed ? "Expand" : "Collapse"}
          >
            <svg
              className={`w-3.5 h-3.5 text-slate-600 transition-transform ${
                isLegendCollapsed ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Compact Day List */}
      {!isLegendCollapsed && (
        <div className="px-2 py-1 space-y-0.5 max-h-[300px] overflow-y-auto">
          {days.map((day, index) => {
            const dayColor = getDayColor(index);
            const isVisible = visibleDays.has(index);
            const formattedDate = day.date
              ? new Date(day.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "";

            return (
              <button
                key={day.index}
                onClick={() => toggleDay(index)}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-slate-50 transition-colors text-left"
              >
                {/* Compact Colored Circle */}
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-semibold text-[10px] flex-shrink-0 bg-[var(--day-color)]"
                  style={{ "--day-color": dayColor } as React.CSSProperties}
                >
                  {index + 1}
                </div>

                {/* Day Info - Single Line */}
                <div className="flex-1 min-w-0 flex items-baseline gap-1">
                  <span className="text-xs font-medium text-slate-900 truncate">
                    {day.title}
                  </span>
                  {formattedDate && (
                    <span className="text-[10px] text-slate-500 flex-shrink-0">
                      {formattedDate}
                    </span>
                  )}
                </div>

                {/* Compact Eye Icon */}
                <div className="flex-shrink-0">
                  {isVisible ? (
                    <svg
                      className="w-3.5 h-3.5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3.5 h-3.5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
