"use client";

import React from "react";

export type EditorMode = "edit" | "story";

export interface StoryModeToggleProps {
  currentMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
}

export const StoryModeToggle: React.FC<StoryModeToggleProps> = ({
  currentMode,
  onModeChange,
  disabled = false
}) => {
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 mb-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {/* Edit Mode Button */}
          <button
            onClick={() => onModeChange("edit")}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
              ${currentMode === "edit"
                ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0"
            >
              <path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Edit Mode
          </button>

          {/* Story Mode Button */}
          <button
            onClick={() => onModeChange("story")}
            disabled={disabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200
              ${currentMode === "story"
                ? "bg-white text-emerald-700 shadow-sm border border-emerald-200"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              }
              ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            `}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="flex-shrink-0"
            >
              <path
                d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Story Mode
          </button>
        </div>

        {/* Mode description */}
        <div className="ml-6 text-sm text-gray-600">
          {currentMode === "edit" ? (
            <span>📝 Full editing mode with all tools</span>
          ) : (
            <span>📖 Read-only narrative view</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryModeToggle;