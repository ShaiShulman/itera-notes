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
  let currentDayDescription = "";
  let currentPlaceText = "";
  let isCapturingPlaceText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for day header: DAY X - Date - Title
    const dayMatch = line.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      // Save previous day if exists
      if (currentDay) {
        // Save any pending place text
        if (isCapturingPlaceText && currentDay.places.length > 0) {
          currentDay.places[currentDay.places.length - 1].paragraph =
            currentPlaceText.trim();
        }
        currentDay.description = currentDayDescription.trim();
        days.push(currentDay);
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
        .replace(/^-\s*/, "")
        .trim();

      currentDay = {
        dayNumber,
        date,
        title: title || `Day ${dayNumber}`,
        description: "",
        places: [],
      };
      currentDayDescription = "";
      currentPlaceText = "";
      isCapturingPlaceText = false;
      continue;
    }

    // Check for place: **Place Name** (lat: XX.XXXXX, lng: XX.XXXXX)
    const placeMatch = line.match(
      /\*\*(.+?)\*\*\s*\(lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\)/i
    );
    if (placeMatch && currentDay) {
      // Save text for the previous place if we were capturing
      if (isCapturingPlaceText && currentDay.places.length > 0) {
        currentDay.places[currentDay.places.length - 1].paragraph =
          currentPlaceText.trim();
      }

      const placeName = placeMatch[1].trim();
      const lat = parseFloat(placeMatch[2]);
      const lng = parseFloat(placeMatch[3]);

      if (!isNaN(lat) && !isNaN(lng)) {
        currentDay.places.push({
          name: placeName,
          lat,
          lng,
        });
        // Start capturing text for this place
        currentPlaceText = "";
        isCapturingPlaceText = true;
      }
      continue;
    }

    // If we're capturing place text, add this line to the current place
    if (isCapturingPlaceText && currentDay) {
      // Skip lines that are titles, day headers, or other structural elements
      if (
        !line.toUpperCase().includes("DAY") &&
        !line.toUpperCase().includes("ITINERARY TITLE:") &&
        !line.includes("**")
      ) {
        currentPlaceText += line + " ";
      }
      continue;
    }

    // Add to day description if we're in a day context and it's not a place
    if (
      currentDay &&
      !line.includes("**") &&
      !line.toUpperCase().includes("DAY") &&
      !isCapturingPlaceText
    ) {
      currentDayDescription += line + " ";
    }
  }

  // Don't forget the last day and last place
  if (currentDay) {
    // Save any pending place text
    if (isCapturingPlaceText && currentDay.places.length > 0) {
      currentDay.places[currentDay.places.length - 1].paragraph =
        currentPlaceText.trim();
    }
    currentDay.description = currentDayDescription.trim();
    days.push(currentDay);
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
