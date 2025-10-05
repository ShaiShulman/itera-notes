"use client";

import Image from "next/image";

interface RouteToggleButtonProps {
  routesVisible: boolean;
  onToggle: (visible: boolean) => void;
}

export function RouteToggleButton({
  routesVisible,
  onToggle,
}: RouteToggleButtonProps) {
  return (
    <button
      onClick={() => onToggle(!routesVisible)}
      className={`p-2 ${
        routesVisible
          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
          : "bg-gray-300 hover:bg-gray-400 text-gray-700"
      } rounded-lg transition-colors shadow-lg`}
      title={routesVisible ? "Hide routes" : "Show routes"}
    >
      <Image
        src="/icons/route.svg"
        alt="Route"
        width={20}
        height={20}
        className="w-5 h-5"
        style={{
          filter: routesVisible ? "brightness(0) invert(1)" : "none",
        }}
      />
    </button>
  );
}
