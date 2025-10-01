import { PlaceLocation, ItineraryDay, GeneratedItinerary } from "./types";
// import { cleanString } from "@/utils/strings";
import { getUniqueId } from "@/utils/getUniqueId";
import { TRANSPORT_MODES, TransportMode } from "@/types/transport";

export type { PlaceLocation, ItineraryDay, GeneratedItinerary };

function extractShortNameAndCleanParagraph(paragraph: string): {
  shortName: string;
  cleanedParagraph: string;
} {
  // Look for **PlaceName** pattern within the paragraph text
  const match = paragraph.match(/\*\*([^*]+)\*\*/);
  const shortName = match ? match[1] : "";
  const cleanedParagraph = paragraph.trim();
  return { shortName, cleanedParagraph };
}

function extractRegionFromDescription(description: string): string | undefined {
  const regionMatch = description.match(/\*\*"([^"]+)"/);
  return regionMatch ? regionMatch[1] : undefined;
}

function extractRegionFromTitle(title: string): string | undefined {
  // Match **RegionName** pattern in title
  const regionMatch = title.match(/\*\*([^*]+)\*\*/);
  return regionMatch ? regionMatch[1] : undefined;
}

export function parseItineraryResponse(
  response: string,
  destination: string,
  startDate: string,
  totalDays: number
): GeneratedItinerary {
  const lines = response
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Extract title
  const titleLine = lines.find((line) =>
    line.toUpperCase().includes("ITINERARY TITLE:")
  );
  const title = titleLine
    ? titleLine.split(":")[1]?.trim() || `${destination} Adventure`
    : `${destination} Adventure`;

  const days: ItineraryDay[] = [];
  let currentDay: ItineraryDay | null = null;
  let currentPlace: PlaceLocation | null = null;
  let pendingDescription = "";
  let collectingDayDescription = false;
  let lastKnownRegion = "";

  console.log("🔍 Starting to parse itinerary response");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`📝 Line ${i}: ${line}`);

    // Check for day header: DAY X - Date - Title - Transport: mode
    const dayMatch = line.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      console.log(`📅 Found day header: ${line}`);

      // Save pending description to current place if exists
      if (currentPlace && pendingDescription.trim()) {
        const { shortName, cleanedParagraph } =
          extractShortNameAndCleanParagraph(pendingDescription.trim());
        currentPlace.paragraph = cleanedParagraph;
        currentPlace.shortName = shortName;

        // Generate linkedParagraphId for places with paragraphs in generated content
        if (cleanedParagraph.trim()) {
          currentPlace.linkedParagraphId = getUniqueId();
          console.log(
            `🔗 LINKED: "${
              currentPlace.name
            }" → paragraph ${currentPlace.linkedParagraphId.slice(0, 8)}`
          );
        }

        console.log(
          `💾 SAVED PARAGRAPH: "${currentPlace.name}" → "${cleanedParagraph}"${
            shortName ? ` (shortName: ${shortName})` : ""
          }`
        );
      }

      // Save previous day if exists
      if (currentDay) {
        days.push(currentDay);
        console.log(
          `📤 Saved day ${currentDay.dayNumber} with ${currentDay.places.length} places`
        );
      }

      // Parse day info
      const dayNumber = parseInt(dayMatch[1]);
      const dayInfo = dayMatch[2];

      // Extract date and title
      const dateMatch = dayInfo.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch
        ? dateMatch[1]
        : calculateDateForDay(startDate, dayNumber - 1);

      // Extract transport mode from day info
      const transportMatch = dayInfo.match(/Transport:\s*(driving|transit|walking)/i);
      const transportMode = transportMatch ? transportMatch[1].toLowerCase() as TransportMode : TRANSPORT_MODES.DRIVING;

      const titleWithRegion = dayInfo
        .replace(/\d{4}-\d{2}-\d{2}/, "")
        .replace(/Transport:\s*(driving|transit|walking)/i, "") // Remove transport info
        .replace(/^\s*-\s*/, "") // Remove any leading " - "
        .replace(/\s*-\s*$/, "") // Remove any trailing " - "
        .trim();

      // Extract region from title before cleaning it
      const extractedRegion = extractRegionFromTitle(titleWithRegion);
      if (extractedRegion) {
        lastKnownRegion = extractedRegion;
        console.log(
          `🌍 Extracted region from day title ${dayNumber}: ${extractedRegion}`
        );
      }

      // Clean the title by removing region markers and extra asterisks
      const cleanTitle = titleWithRegion
        .replace(/\*\*/g, "") // Remove any remaining asterisks
        .trim();

      currentDay = {
        dayNumber,
        date,
        title: cleanTitle || `Day ${dayNumber}`,
        description: "",
        region: lastKnownRegion,
        transportMode,
        places: [],
      };

      currentPlace = null;
      pendingDescription = "";
      collectingDayDescription = true; // Start collecting day description after day header
      console.log(`🆕 Created new day: ${currentDay.title}`);
      continue;
    }

    // Check for place: **Place Name** (lat: XX.XXXXX, lng: XX.XXXXX)
    const placeMatch = line.match(
      /\*\*(.+?)\*\*\s*\(lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\)/i
    );
    if (placeMatch && currentDay) {
      console.log(`📍 Found place: ${placeMatch[1]}`);

      // Save pending description to current place if exists
      if (currentPlace && pendingDescription.trim()) {
        const { shortName, cleanedParagraph } =
          extractShortNameAndCleanParagraph(pendingDescription.trim());
        currentPlace.paragraph = cleanedParagraph;
        currentPlace.shortName = shortName;

        // Generate linkedParagraphId for places with paragraphs in generated content
        if (cleanedParagraph.trim()) {
          currentPlace.linkedParagraphId = getUniqueId();
          console.log(
            `🔗 LINKED: "${
              currentPlace.name
            }" → paragraph ${currentPlace.linkedParagraphId.slice(0, 8)}`
          );
        }

        console.log(
          `💾 SAVED PARAGRAPH: "${currentPlace.name}" → "${cleanedParagraph}"${
            shortName ? ` (shortName: ${shortName})` : ""
          }`
        );
      }

      const placeName = placeMatch[1].replace("**", "").trim();
      const lat = parseFloat(placeMatch[2]);
      const lng = parseFloat(placeMatch[3]);

      if (!isNaN(lat) && !isNaN(lng)) {
        currentPlace = {
          name: placeName,
          lat,
          lng,
          paragraph: "", // Initialize as empty
          shortName: "", // Will be extracted from paragraph
          linkedParagraphId: "", // Will be set when paragraph is saved
        };
        currentDay.places.push(currentPlace);
        pendingDescription = "";
        collectingDayDescription = false; // Stop collecting day description once we hit places
        console.log(
          `➕ CREATED PLACE: "${placeName}" (lat: ${lat}, lng: ${lng})`
        );
      }
      continue;
    }

    // Skip empty lines and structural elements
    if (
      line.toUpperCase().includes("ITINERARY TITLE:") ||
      line.startsWith("**") ||
      line.length === 0
    ) {
      continue;
    }

    // Collect day description (only if we haven't hit any places yet)
    if (collectingDayDescription && currentDay) {
      if (currentDay.description.length > 0) {
        currentDay.description += " ";
      }

      // Clean the line by removing region markers and extra asterisks
      const cleanLine = line
        .replace(/\*\*"[^"]+"/g, "") // Remove **"RegionName" patterns
        .replace(/\*\*/g, "") // Remove any remaining asterisks
        .trim();

      currentDay.description += cleanLine;

      // Check if this line contains a region marker and extract it
      const extractedRegion = extractRegionFromDescription(line);
      if (extractedRegion) {
        currentDay.region = extractedRegion;
        lastKnownRegion = extractedRegion;
        console.log(
          `🌍 Extracted region for day ${currentDay.dayNumber}: ${extractedRegion}`
        );
      }

      console.log(`📄 Added to day description: ${cleanLine}`);
      continue;
    }

    // Collect place description (if we have a current place)
    if (currentPlace) {
      if (pendingDescription.length > 0) {
        pendingDescription += " ";
      }
      pendingDescription += line;
      console.log(`📝 Added to pending place description: ${line}`);
      continue;
    }
  }

  // Don't forget to save the last place's description and last day
  if (currentPlace && pendingDescription.trim()) {
    const { shortName, cleanedParagraph } = extractShortNameAndCleanParagraph(
      pendingDescription.trim()
    );
    currentPlace.paragraph = cleanedParagraph;
    currentPlace.shortName = shortName;

    // Generate linkedParagraphId for places with paragraphs in generated content
    if (cleanedParagraph.trim()) {
      currentPlace.linkedParagraphId = getUniqueId();
      console.log(
        `🔗 LINKED: "${
          currentPlace.name
        }" → paragraph ${currentPlace.linkedParagraphId.slice(0, 8)}`
      );
    }

    console.log(
      `💾 SAVED FINAL PARAGRAPH: "${
        currentPlace.name
      }" → "${cleanedParagraph}"${
        shortName ? ` (shortName: ${shortName})` : ""
      }`
    );
  }

  if (currentDay) {
    days.push(currentDay);
    console.log(
      `📤 Saved final day ${currentDay.dayNumber} with ${currentDay.places.length} places`
    );
  }

  // Fill in missing days if needed
  while (days.length < totalDays) {
    const dayNumber = days.length + 1;
    days.push({
      dayNumber,
      date: calculateDateForDay(startDate, dayNumber - 1),
      title: `Day ${dayNumber}`,
      description: "Free time to explore",
      region: lastKnownRegion, // Use last known region for missing days
      transportMode: "driving", // Default transport mode for missing days
      places: [],
    });
  }

  console.log(`✅ Parsing complete. Found ${days.length} days total.`);

  return {
    title,
    destination,
    totalDays,
    days: days.slice(0, totalDays), // Ensure we don't exceed the requested days
  };
}

function calculateDateForDay(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split("T")[0];
}
