import { SkeletonItinerary, SkeletonDay, SkeletonPlace } from "./types";
import { TRANSPORT_MODES, TransportMode } from "@/types/transport";

/**
 * Parse skeleton itinerary response from OpenAI
 */
export function parseSkeletonResponse(
  response: string,
  destination: string,
  startDate: string,
  totalDays: number
): SkeletonItinerary {
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

  const days: SkeletonDay[] = [];
  let currentDay: SkeletonDay | null = null;
  let currentPlace: SkeletonPlace | null = null;
  let collectingField: "description" | "activities" | "time" | "transit" | null =
    null;
  let currentFacts: string[] = [];

  console.log("🔍 Starting to parse skeleton response");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for day header: DAY X - Date - Title - Transport: mode
    const dayMatch = line.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      console.log(`📅 Found day header: ${line}`);

      // Save previous day if exists
      if (currentDay && currentPlace) {
        currentDay.places.push(currentPlace);
      }
      if (currentDay) {
        days.push(currentDay);
      }

      // Parse day info
      const dayNumber = parseInt(dayMatch[1]);
      const dayInfo = dayMatch[2];

      // Extract date
      const dateMatch = dayInfo.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch
        ? dateMatch[1]
        : calculateDateForDay(startDate, dayNumber - 1);

      // Extract transport mode
      const transportMatch = dayInfo.match(
        /Transport:\s*(driving|transit|walking)/i
      );
      const transportMode = transportMatch
        ? (transportMatch[1].toLowerCase() as TransportMode)
        : TRANSPORT_MODES.DRIVING;

      // Extract title
      const titleWithTransport = dayInfo
        .replace(/\d{4}-\d{2}-\d{2}/, "")
        .replace(/Transport:\s*(driving|transit|walking)/i, "")
        .replace(/^\s*-\s*/, "")
        .replace(/\s*-\s*$/, "")
        .trim();

      currentDay = {
        dayNumber,
        date,
        title: titleWithTransport || `Day ${dayNumber}`,
        transportMode,
        places: [],
      };

      currentPlace = null;
      collectingField = null;
      console.log(`🆕 Created new day: ${currentDay.title}`);
      continue;
    }

    // Check for place: **Place Name** (lat: XX.XXXXX, lng: XX.XXXXX)
    const placeMatch = line.match(
      /\*\*(.+?)\*\*\s*\(lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\)/i
    );
    if (placeMatch && currentDay) {
      console.log(`📍 Found place: ${placeMatch[1]}`);

      // Save previous place if exists
      if (currentPlace) {
        currentDay.places.push(currentPlace);
      }

      const placeName = placeMatch[1].trim();
      const lat = parseFloat(placeMatch[2]);
      const lng = parseFloat(placeMatch[3]);

      currentPlace = {
        name: placeName,
        lat,
        lng,
        description: "",
        activities: "",
        time: "",
        transit: "",
        interestingFacts: [],
      };

      collectingField = null;
      currentFacts = [];
      console.log(`➕ Created place: "${placeName}"`);
      continue;
    }

    // Check for field markers
    if (line.startsWith("Description:")) {
      collectingField = "description";
      if (currentPlace) {
        currentPlace.description = line.replace("Description:", "").trim();
      }
      continue;
    }

    if (line.startsWith("Activities:")) {
      collectingField = "activities";
      if (currentPlace) {
        currentPlace.activities = line.replace("Activities:", "").trim();
      }
      continue;
    }

    if (line.startsWith("Time:")) {
      collectingField = "time";
      if (currentPlace) {
        currentPlace.time = line.replace("Time:", "").trim();
      }
      continue;
    }

    if (line.startsWith("Transit:")) {
      collectingField = "transit";
      if (currentPlace) {
        currentPlace.transit = line.replace("Transit:", "").trim();
      }
      continue;
    }

    if (line.startsWith("Fact 1:")) {
      collectingField = null;
      if (currentPlace) {
        const fact = line.replace("Fact 1:", "").trim();
        currentFacts[0] = fact;
      }
      continue;
    }

    if (line.startsWith("Fact 2:")) {
      collectingField = null;
      if (currentPlace) {
        const fact = line.replace("Fact 2:", "").trim();
        currentFacts[1] = fact;
        // Save facts to current place
        currentPlace.interestingFacts = [...currentFacts];
        console.log(`  ✅ Extracted ${currentFacts.length} facts for "${currentPlace.name}"`);
      }
      continue;
    }

    // Continue collecting field data if we're in a field
    if (collectingField && currentPlace && line.length > 0) {
      const currentValue = currentPlace[collectingField] || "";
      currentPlace[collectingField] =
        currentValue + (currentValue ? " " : "") + line;
    }
  }

  // Save last place and day
  if (currentPlace && currentDay) {
    currentDay.places.push(currentPlace);
  }
  if (currentDay) {
    days.push(currentDay);
  }

  // Fill in missing days if needed
  while (days.length < totalDays) {
    const dayNumber = days.length + 1;
    days.push({
      dayNumber,
      date: calculateDateForDay(startDate, dayNumber - 1),
      title: `Day ${dayNumber}`,
      transportMode: "driving",
      places: [],
    });
  }

  console.log(`✅ Skeleton parsing complete. Found ${days.length} days.`);

  return {
    title,
    destination,
    totalDays,
    days: days.slice(0, totalDays),
  };
}

function calculateDateForDay(startDate: string, dayOffset: number): string {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().split("T")[0];
}
