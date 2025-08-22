"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

export interface InlinePlaceNameProps {
  name: string;
  shortName?: string;
  thumbnailUrl?: string;
  placeId?: string;
  dataKey?: string; // For identifying the element for popup positioning
  placeType?: "place" | "hotel"; // Type of place for styling
  onClick?: () => void;
  onHover?: (isHovering: boolean, element?: HTMLElement) => void;
}

export const InlinePlaceName: React.FC<InlinePlaceNameProps> = ({
  name,
  shortName,
  thumbnailUrl,
  placeId,
  dataKey,
  placeType = "place",
  onClick,
  onHover,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const displayName = shortName || name;

  // Define colors based on place type
  const colors = placeType === "hotel" 
    ? {
        background: "bg-violet-50",
        border: "border-violet-200", 
        hoverBackground: "hover:bg-violet-100",
        textColor: "text-violet-700"
      }
    : {
        background: "bg-emerald-50",
        border: "border-emerald-200",
        hoverBackground: "hover:bg-emerald-100", 
        textColor: "text-emerald-700"
      };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      console.log("🐭 MOUSE ENTER:", name, {
        hasOnHover: !!onHover,
        element: e.currentTarget,
      });

      // Capture the element reference before the timeout
      const element = e.currentTarget;

      // Set timeout for 300ms before showing popup
      hoverTimeoutRef.current = setTimeout(() => {
        console.log("🐭 TIMEOUT TRIGGERED for:", name, { element });
        onHover?.(true, element);
      }, 300);
    },
    [name, onHover]
  );

  const handleMouseLeave = useCallback(() => {
    // Clear timeout if user leaves before timeout completes
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = undefined;
    }

    console.log("🐭 MOUSE LEAVE:", name);
    onHover?.(false);
  }, [name, onHover]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.();
    },
    [onClick]
  );

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 mx-1 ${colors.background} border ${colors.border} rounded-md ${colors.hoverBackground} transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      data-place-key={dataKey}
      onClick={onClick ? handleClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={shortName ? `${shortName} (${name})` : name}
    >
      {/* Thumbnail */}
      {thumbnailUrl && placeId && (
        <span className="relative inline-block w-4 h-4 flex-shrink-0 overflow-visible">
          {!imageLoaded && !imageError && (
            <span 
              className="inline-block bg-gray-200 rounded animate-pulse" 
              style={{ 
                width: '20px', 
                height: '20px',
                marginTop: '-2px',
                marginBottom: '-2px',
                marginLeft: '-2px',
                marginRight: '-2px'
              }} 
            />
          )}

          <Image
            src={`/api/places/photos/${thumbnailUrl}?width=64`}
            alt={displayName}
            width={20}
            height={20}
            className={`transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={() => {
              setImageError(true);
              setImageLoaded(false);
            }}
            style={{
              position: imageLoaded ? "static" : "absolute",
              top: imageLoaded ? "auto" : '-2px',
              left: imageLoaded ? "auto" : '-2px',
              width: '20px',
              height: '20px',
              minWidth: '20px',
              minHeight: '20px',
              maxWidth: '20px',
              maxHeight: '20px',
              objectFit: 'cover',
              objectPosition: 'center',
              borderRadius: '4px',
              display: 'block',
              marginTop: '-2px',
              marginBottom: '-2px',
              marginLeft: '-2px',
              marginRight: '-2px'
            }}
            sizes="20px"
          />
        </span>
      )}

      {/* Place name */}
      <span className={`${colors.textColor} font-medium text-sm`}>
        {displayName}
      </span>
    </span>
  );
};

export default InlinePlaceName;
