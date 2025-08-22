"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { EditorData, BasePlaceBlockData } from "../../editor/types";
import StoryDayComponent, { StoryDayData } from "./StoryDayComponent";
import InlinePlaceName from "./InlinePlaceName";
import PlaceDetailsPopup from "./PlaceDetailsPopup";
import {
  extractDayNumberFromPlace,
  getPreviousLocationForPlace,
} from "../../editor/utils/placeUtils";

export interface StoryModeViewProps {
  editorData: EditorData;
}

interface ProcessedContent {
  title: string;
  description: string;
  allPlaces: Map<string, BasePlaceBlockData>;
  days: {
    dayData: StoryDayData;
    content: ContentBlock[];
  }[];
}

interface ContentBlock {
  id: string;
  type: "header" | "paragraph" | "day-description";
  content: string;
  linkedPlaces: BasePlaceBlockData[]; // Places linked to this content
}

export const StoryModeView: React.FC<StoryModeViewProps> = ({ editorData }) => {
  const [selectedPlace, setSelectedPlace] = useState<BasePlaceBlockData | null>(
    null
  );
  const [popupTrigger, setPopupTrigger] = useState<HTMLElement | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Process editor data into story format
  const processedContent = useMemo(() => {
    return processEditorDataForStory(editorData);
  }, [editorData]);

  // Click-away listener to unpin popup when clicking outside
  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!isPinned) return;
      
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on the popup itself or an inline place name
      if (target.closest('.fixed.z-50') || target.closest('[data-place-key]')) {
        return;
      }
      
      console.log("🖱️ CLICK AWAY detected - unpinning popup");
      setIsPinned(false);
      setSelectedPlace(null);
      setPopupTrigger(null);
      
      // Emit hover end event to clear map interactions
      if (typeof window !== "undefined") {
        const event = new CustomEvent("story:hoverEnd", {
          detail: {},
        });
        window.dispatchEvent(event);
        console.log("📡 story:hoverEnd event emitted (from click away)");
      }
    };

    if (isPinned) {
      document.addEventListener('click', handleClickAway);
      return () => {
        document.removeEventListener('click', handleClickAway);
      };
    }
  }, [isPinned]);

  // Listen for map place clicks to scroll into view
  useEffect(() => {
    const handleMapPlaceClick = (event: CustomEvent) => {
      const { uid, name } = event.detail;
      console.log("🗺️ StoryModeView: Received map place click:", { uid, name });

      // Find the place element in the story view and scroll to it
      const placeElement = document.querySelector(`[data-place-key*="${uid}"]`) as HTMLElement;
      if (placeElement) {
        console.log("📍 StoryModeView: Scrolling to place element:", name);
        placeElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        
        // Briefly highlight the element
        placeElement.style.backgroundColor = '#fef3c7';
        placeElement.style.transition = 'background-color 0.3s ease';
        setTimeout(() => {
          placeElement.style.backgroundColor = '';
        }, 1500);
      } else {
        console.warn("📍 StoryModeView: Could not find place element for uid:", uid);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("map:placeClicked", handleMapPlaceClick as EventListener);
      return () => {
        window.removeEventListener("map:placeClicked", handleMapPlaceClick as EventListener);
      };
    }
  }, []);

  const handlePlaceHover = (
    place: BasePlaceBlockData,
    isHovering: boolean,
    element?: HTMLElement
  ) => {
    console.log("🎯 PLACE HOVER:", {
      placeName: place.name,
      isHovering,
      hasElement: !!element,
      isPinned
    });

    // Don't respond to hover events when popup is pinned
    if (isPinned) {
      console.log("🔒 POPUP PINNED - ignoring hover");
      return;
    }

    if (isHovering && element) {
      setSelectedPlace(place);
      setPopupTrigger(element);
      console.log("🔥 POPUP SET:", {
        placeName: place.name,
        elementTag: element.tagName,
      });

      // Emit custom event for place hover
      if (typeof window !== "undefined") {
        const event = new CustomEvent("story:placeHover", {
          detail: {
            place: place,
            dayNumber: extractDayNumberFromPlace(place),
          },
        });
        window.dispatchEvent(event);
        console.log("📡 story:placeHover event emitted:", {
          placeName: place.name,
        });
      }
    } else {
      setSelectedPlace(null);
      setPopupTrigger(null);
      console.log("❌ POPUP CLEARED");

      // Emit custom event for hover end
      if (typeof window !== "undefined") {
        const event = new CustomEvent("story:hoverEnd", {
          detail: {},
        });
        window.dispatchEvent(event);
        console.log("📡 story:hoverEnd event emitted");
      }
    }
  };

  const handlePlaceClick = (
    place: BasePlaceBlockData,
    element: HTMLElement
  ) => {
    console.log("🖱️ PLACE CLICK:", {
      placeName: place.name,
      currentlyPinned: isPinned,
      currentSelectedPlace: selectedPlace?.name
    });

    // If clicking the same place that's already pinned, unpin it
    if (isPinned && selectedPlace?.uid === place.uid) {
      setIsPinned(false);
      setSelectedPlace(null);
      setPopupTrigger(null);
      console.log("📌 UNPINNED popup");
      return;
    }

    // Pin the popup for this place
    setSelectedPlace(place);
    setPopupTrigger(element);
    setIsPinned(true);
    console.log("📌 PINNED popup for:", place.name);

    // Emit custom event for place hover (for map integration)
    if (typeof window !== "undefined") {
      const event = new CustomEvent("story:placeHover", {
        detail: {
          place: place,
          dayNumber: extractDayNumberFromPlace(place),
        },
      });
      window.dispatchEvent(event);
      console.log("📡 story:placeHover event emitted (from click):", {
        placeName: place.name,
      });
    }
  };

  // Helper function to find the previous place for driving time context (same day or previous day)
  const getPreviousPlaceName = (
    currentPlace: BasePlaceBlockData
  ): string | undefined => {
    if (!processedContent?.allPlaces || !currentPlace.uid) return undefined;

    const allPlacesArray = Array.from(processedContent.allPlaces.values());
    return getPreviousLocationForPlace(currentPlace, allPlacesArray);
  };

  const handleDayHover = (isHovering: boolean, dayNumber: number) => {
    console.log("🏛️ DAY HOVER:", { dayNumber, isHovering });

    if (isHovering) {
      // Emit custom event for day hover
      if (typeof window !== "undefined") {
        // Get places for this day
        const dayPlaces = Array.from(
          processedContent?.allPlaces.values() || []
        ).filter((place) => {
          const placeDayNumber = extractDayNumberFromPlace(place);
          return placeDayNumber === dayNumber;
        });

        const event = new CustomEvent("story:dayHover", {
          detail: {
            dayNumber,
            places: dayPlaces,
          },
        });
        window.dispatchEvent(event);
        console.log("📡 story:dayHover event emitted:", {
          dayNumber,
          placeCount: dayPlaces.length,
        });
      }
    } else {
      // Emit custom event for hover end
      if (typeof window !== "undefined") {
        const event = new CustomEvent("story:hoverEnd", {
          detail: {},
        });
        window.dispatchEvent(event);
        console.log("📡 story:hoverEnd event emitted from day");
      }
    }
  };

  if (!processedContent) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">No content to display</h3>
          <p className="text-sm">
            Switch to Edit Mode to add content to your itinerary.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Title and Description */}
      {processedContent.title && (
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {processedContent.title}
          </h1>
          {processedContent.description && (
            <p className="text-lg text-gray-600">
              {processedContent.description}
            </p>
          )}
        </div>
      )}

      {/* Days Content */}
      <div className="space-y-8">
        {processedContent.days.map((daySection) => (
          <div
            key={`day-${daySection.dayData.dayNumber}`}
            className="space-y-4"
          >
            {/* Day Header */}
            <StoryDayComponent
              day={daySection.dayData}
              onHover={handleDayHover}
            />

            {/* Day Content */}
            <div className="space-y-4">
              {daySection.content.map((block) => (
                <ContentBlockRenderer
                  key={block.id}
                  block={block}
                  allPlaces={processedContent.allPlaces}
                  onPlaceHover={handlePlaceHover}
                  onPlaceClick={handlePlaceClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Place Details Popup */}
      <PlaceDetailsPopup
        placeData={selectedPlace || ({} as BasePlaceBlockData)}
        isVisible={!!selectedPlace}
        triggerElement={popupTrigger || undefined}
        previousPlaceName={
          selectedPlace ? getPreviousPlaceName(selectedPlace) : undefined
        }
        onClose={() => {
          setSelectedPlace(null);
          setPopupTrigger(null);
          setIsPinned(false);
          console.log("🚫 POPUP CLOSED - reset pinned state");
          
          // Emit hover end event to clear map interactions
          if (typeof window !== "undefined") {
            const event = new CustomEvent("story:hoverEnd", {
              detail: {},
            });
            window.dispatchEvent(event);
            console.log("📡 story:hoverEnd event emitted (from close)");
          }
        }}
      />
    </div>
  );
};

// Component to render individual content blocks
const ContentBlockRenderer: React.FC<{
  block: ContentBlock;
  allPlaces: Map<string, BasePlaceBlockData>;
  onPlaceHover: (
    place: BasePlaceBlockData,
    isHovering: boolean,
    element?: HTMLElement
  ) => void;
  onPlaceClick: (
    place: BasePlaceBlockData,
    element: HTMLElement
  ) => void;
}> = ({ block, allPlaces, onPlaceHover, onPlaceClick }) => {
  // Function to render content with inline place names
  const renderContentWithPlaces = (
    content: string,
    linkedPlaces: BasePlaceBlockData[],
    allPlaces?: Map<string, BasePlaceBlockData>
  ) => {
    // Look for **PlaceName** patterns in the content
    const placePattern = /\*\*([^*]+)\*\*/g;
    const matches = Array.from(content.matchAll(placePattern));

    if (matches.length === 0) {
      return <span>{content}</span>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    matches.forEach((match, index) => {
      const [fullMatch, placeName] = match;
      const matchStart = match.index!;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before the match
      if (matchStart > lastIndex) {
        elements.push(content.slice(lastIndex, matchStart));
      }

      // Find the corresponding place data
      // First try to find by exact name match, then by shortName
      let matchingPlace: BasePlaceBlockData | undefined;

      // Check linked places first (for backwards compatibility)
      matchingPlace = linkedPlaces.find(
        (place) => place.name === placeName || place.shortName === placeName
      );

      // If not found in linked places, search all places (for new **PlaceName** format)
      if (!matchingPlace && allPlaces) {
        for (const place of allPlaces.values()) {
          if (place.name === placeName || place.shortName === placeName) {
            matchingPlace = place;
            break;
          }
        }
      }

      if (matchingPlace) {
        const dataKey = `place-${matchingPlace.uid || index}-${index}`;
        // Add the inline place component
        elements.push(
          <InlinePlaceName
            key={dataKey}
            name={matchingPlace.name || placeName}
            shortName={matchingPlace.shortName}
            thumbnailUrl={matchingPlace.thumbnailUrl}
            placeId={matchingPlace.placeId}
            placeType={(matchingPlace as any).__type === "hotel" ? "hotel" : "place"}
            dataKey={dataKey}
            onHover={(isHovering: boolean, element?: HTMLElement) => {
              console.log("🎯 InlinePlaceName onHover called:", {
                placeName: matchingPlace?.name,
                isHovering,
                hasElement: !!element,
              });
              onPlaceHover(matchingPlace!, isHovering, element);
            }}
            onClick={() => {
              console.log("🖱️ InlinePlaceName onClick called:", {
                placeName: matchingPlace?.name,
              });
              // Find the DOM element for this place component
              const element = document.querySelector(`[data-place-key="${dataKey}"]`) as HTMLElement;
              if (element) {
                onPlaceClick(matchingPlace!, element);
              }
            }}
          />
        );
      } else {
        // If place not found, render as regular text without the ** markers
        elements.push(placeName);
      }

      lastIndex = matchEnd;
    });

    // Add remaining text
    if (lastIndex < content.length) {
      elements.push(content.slice(lastIndex));
    }

    return <>{elements}</>;
  };

  const baseClasses = "leading-relaxed";

  switch (block.type) {
    case "header":
      return (
        <h2 className={`text-2xl font-bold text-gray-800 ${baseClasses}`}>
          {renderContentWithPlaces(
            block.content,
            block.linkedPlaces,
            allPlaces
          )}
        </h2>
      );

    case "day-description":
      return (
        <div className="p-4 bg-gray-50 border-l-4 border-gray-300 rounded-r-lg">
          <p className={`text-gray-700 ${baseClasses}`}>
            {renderContentWithPlaces(
              block.content,
              block.linkedPlaces,
              allPlaces
            )}
          </p>
        </div>
      );

    case "paragraph":
    default:
      return (
        <p className={`text-gray-800 ${baseClasses}`}>
          {renderContentWithPlaces(
            block.content,
            block.linkedPlaces,
            allPlaces
          )}
        </p>
      );
  }
};

// Main processing function
function processEditorDataForStory(
  editorData: EditorData
): ProcessedContent | null {
  if (!editorData.blocks || editorData.blocks.length === 0) {
    return null;
  }

  const blocks = editorData.blocks;
  let title = "";
  let description = "";
  const days: { dayData: StoryDayData; content: ContentBlock[] }[] = [];

  // Create maps for quick lookup
  const placesByLinkedParagraph = new Map<string, BasePlaceBlockData[]>();
  const allPlaces = new Map<string, BasePlaceBlockData>();

  // First pass: collect all places and their linked paragraphs
  blocks.forEach((block) => {
    if (block.type === "place" || block.type === "hotel") {
      const placeData = block.data as BasePlaceBlockData;
      if (placeData.uid) {
        allPlaces.set(placeData.uid, placeData);

        if (placeData.linkedParagraphId) {
          const existing =
            placesByLinkedParagraph.get(placeData.linkedParagraphId) || [];
          existing.push(placeData);
          placesByLinkedParagraph.set(placeData.linkedParagraphId, existing);
        }
      }
    }
  });

  // Extract title and description
  const headerBlock = blocks.find((block) => block.type === "header");
  if (headerBlock && (headerBlock.data as any).text) {
    title = (headerBlock.data as any).text;
  }

  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  if (firstParagraph && (firstParagraph.data as any).text) {
    const text = (firstParagraph.data as any).text;
    if (text.includes("-day trip to")) {
      description = text;
    }
  }

  // Process days
  const dayBlocks = blocks.filter((block) => block.type === "day");

  dayBlocks.forEach((dayBlock) => {
    const dayData = dayBlock.data as any; // EditorJS data structure
    const dayNumber = dayData.dayNumber || 1;

    // Calculate day stats
    const dayPlaces = Array.from(allPlaces.values()).filter((place) => {
      // Get place's day number from its position or data
      return place.uid?.startsWith(`place_${dayNumber}_`);
    });

    const totalDrivingTime = dayPlaces.reduce(
      (sum, place) => sum + (place.drivingTimeFromPrevious || 0),
      0
    );
    const totalDrivingDistance = dayPlaces.reduce(
      (sum, place) => sum + (place.drivingDistanceFromPrevious || 0),
      0
    );

    const storyDay: StoryDayData = {
      dayNumber,
      title: dayData.title || `Day ${dayNumber}`,
      date: dayData.date,
      region: dayData.region,
      totalDrivingTime,
      totalDrivingDistance,
      placeCount: dayPlaces.length,
    };

    // Collect content blocks for this day
    const dayContent: ContentBlock[] = [];

    // Add day description if exists
    if (dayData.description) {
      dayContent.push({
        id: `day-desc-${dayNumber}`,
        type: "day-description",
        content: dayData.description,
        linkedPlaces: [],
      });
    }

    // Find paragraphs that belong to this day (after this day block, before next day block)
    const dayBlockIndex = blocks.indexOf(dayBlock);
    const nextDayBlockIndex = blocks.findIndex(
      (block, index) => index > dayBlockIndex && block.type === "day"
    );
    const endIndex =
      nextDayBlockIndex === -1 ? blocks.length : nextDayBlockIndex;

    for (let i = dayBlockIndex + 1; i < endIndex; i++) {
      const block = blocks[i];
      if (block.type === "paragraph") {
        const paragraphData = block.data as any;
        const linkedPlaces = placesByLinkedParagraph.get(block.id || "") || [];

        dayContent.push({
          id: block.id || `para-${i}`,
          type: "paragraph",
          content: paragraphData.text || "",
          linkedPlaces,
        });
      } else if (block.type === "header" && i > 0) {
        const headerData = block.data as any;
        dayContent.push({
          id: block.id || `header-${i}`,
          type: "header",
          content: headerData.text || "",
          linkedPlaces: [],
        });
      }
    }

    days.push({
      dayData: storyDay,
      content: dayContent,
    });
  });

  return {
    title,
    description,
    allPlaces,
    days,
  };
}

export default StoryModeView;
