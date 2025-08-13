import { PlaceLocation, ItineraryDay, GeneratedItinerary } from "./types";

export type { PlaceLocation, ItineraryDay, GeneratedItinerary };

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

  console.log("🔍 Starting to parse itinerary response");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`📝 Line ${i}: ${line}`);

    // Check for day header: DAY X - Date - Title
    const dayMatch = line.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      console.log(`📅 Found day header: ${line}`);
      
      // Save pending description to current place if exists
      if (currentPlace && pendingDescription.trim()) {
        currentPlace.paragraph = pendingDescription.trim();
        console.log(`💾 Saved description to place "${currentPlace.name}": ${pendingDescription.trim()}`);
      }

      // Save previous day if exists
      if (currentDay) {
        days.push(currentDay);
        console.log(`📤 Saved day ${currentDay.dayNumber} with ${currentDay.places.length} places`);
      }

      // Parse day info
      const dayNumber = parseInt(dayMatch[1]);
      const dayInfo = dayMatch[2];

      // Extract date and title
      const dateMatch = dayInfo.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch
        ? dateMatch[1]
        : calculateDateForDay(startDate, dayNumber - 1);

      const title = dayInfo
        .replace(/\d{4}-\d{2}-\d{2}/, "")
        .replace(/^\s*-\s*/, "") // Remove any leading " - "
        .trim();

      currentDay = {
        dayNumber,
        date,
        title: title || `Day ${dayNumber}`,
        description: "",
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
        currentPlace.paragraph = pendingDescription.trim();
        console.log(`💾 Saved description to place "${currentPlace.name}": ${pendingDescription.trim()}`);
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
        };
        currentDay.places.push(currentPlace);
        pendingDescription = "";
        collectingDayDescription = false; // Stop collecting day description once we hit places
        console.log(`➕ Added place to day: ${placeName}`);
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
      currentDay.description += line;
      console.log(`📄 Added to day description: ${line}`);
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
    currentPlace.paragraph = pendingDescription.trim();
    console.log(`💾 Saved final description to place "${currentPlace.name}": ${pendingDescription.trim()}`);
  }
  
  if (currentDay) {
    days.push(currentDay);
    console.log(`📤 Saved final day ${currentDay.dayNumber} with ${currentDay.places.length} places`);
  }

  // Fill in missing days if needed
  while (days.length < totalDays) {
    const dayNumber = days.length + 1;
    days.push({
      dayNumber,
      date: calculateDateForDay(startDate, dayNumber - 1),
      title: `Day ${dayNumber}`,
      description: "Free time to explore",
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
