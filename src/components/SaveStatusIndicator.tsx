"use client";

import { useState, useEffect } from "react";
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ArrowPathIcon 
} from "@heroicons/react/24/outline";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | null;
  error?: string;
  className?: string;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 10) {
    return "just now";
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}

export default function SaveStatusIndicator({
  status,
  lastSaved,
  error,
  className = ""
}: SaveStatusIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  // Update time ago display every 30 seconds
  useEffect(() => {
    if (lastSaved) {
      const updateTimeAgo = () => {
        setTimeAgo(formatTimeAgo(lastSaved));
      };
      
      updateTimeAgo();
      const interval = setInterval(updateTimeAgo, 30000); // Update every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [lastSaved]);

  // Check if we should use light theme (white text)
  const isLightTheme = className.includes("text-white");

  const getStatusDisplay = () => {
    switch (status) {
      case "saving":
        return (
          <div className={`flex items-center gap-2 ${isLightTheme ? 'text-blue-300' : 'text-blue-600'}`}>
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Saving...</span>
          </div>
        );
      
      case "saved":
        return (
          <div className={`flex items-center gap-2 ${isLightTheme ? 'text-green-300' : 'text-green-600'}`}>
            <CheckCircleIcon className="h-4 w-4" />
            <span className="text-sm">
              {lastSaved ? `Saved ${timeAgo}` : "Saved"}
            </span>
          </div>
        );
      
      case "error":
        return (
          <div className={`flex items-center gap-2 ${isLightTheme ? 'text-red-300' : 'text-red-600'}`} title={error}>
            <ExclamationCircleIcon className="h-4 w-4" />
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 ${isLightTheme ? 'bg-red-400' : 'bg-red-500'} rounded-full animate-pulse`}></div>
              <span className="text-sm font-medium">Save failed</span>
            </div>
          </div>
        );
      
      case "idle":
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();
  
  if (!statusDisplay) {
    return null;
  }

  return (
    <div className={`${className}`}>
      {statusDisplay}
    </div>
  );
}