/**
 * Create a skeleton prompt to generate a list of places with basic information
 * This is step 1 of the multi-step generation process
 */
export function createSkeletonPrompt({
  destination,
  startDate,
  endDate,
  totalDays,
  interests,
  travelStyle,
  transportPreference,
  additionalNotes,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  interests: string[];
  travelStyle: string;
  transportPreference?: string;
  additionalNotes?: string;
}): string {
  return `Create a skeleton itinerary for ${destination} from ${startDate} to ${endDate} (${totalDays} days).

Travel Style: ${travelStyle}
Interests: ${interests.join(", ")}
Transport Preference: ${getTransportInstructions(transportPreference)}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Create a structured plan with:
- Day-by-day breakdown
- 3-5 places per day
- Brief description of each place (1 sentence)
- Main activities at each place
- Estimated time to spend at each place
- Approximate transit time between places
- 2 interesting facts per place that match the traveler's interests

Format your response EXACTLY as follows:

ITINERARY TITLE: [Creative title]

DAY 1 - ${startDate} - [Day Title] - [Transport: driving/transit/walking]

**[Place Name 1]** (lat: XX.XXXXX, lng: XX.XXXXX)
Description: [One sentence about what this place is]
Activities: [What to do here]
Time: [How long to spend]
Transit: [How to get to next place, estimated time]
Fact 1: [Interesting fact relevant to traveler's interests]
Fact 2: [Another interesting fact relevant to traveler's interests]

**[Place Name 2]** (lat: XX.XXXXX, lng: XX.XXXXX)
Description: [One sentence about what this place is]
Activities: [What to do here]
Time: [How long to spend]
Transit: [How to get to next place, estimated time]
Fact 1: [Interesting fact relevant to traveler's interests]
Fact 2: [Another interesting fact relevant to traveler's interests]

Continue for all ${totalDays} days.

Requirements:
- Include realistic coordinates (5 decimal places)
- Consider travel time between locations
- Match activities to interests: ${interests.join(", ")}
- Match the ${travelStyle} style
- Each day should have 3-5 places
- Brief, factual descriptions only
- Focus on logistics and planning
- Each fact should be max 25 words and directly relate to the traveler's interests: ${interests.join(
    ", "
  )}`;
}

export function createItineraryPrompt({
  destination,
  startDate,
  endDate,
  totalDays,
  interests,
  travelStyle,
  transportPreference,
  additionalNotes,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  interests: string[];
  travelStyle: string;
  transportPreference?: string;
  additionalNotes?: string;
}): string {
  return `Create a detailed ${totalDays}-day travel itinerary for ${destination} from ${startDate} to ${endDate}.  

Travel Style: ${travelStyle}
Interests: ${interests.join(", ")}
Transport Preference: ${getTransportInstructions(transportPreference)}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Please format your response EXACTLY as follows:

ITINERARY TITLE: [Creative title for the trip]

DAY 1 - [Date: YYYY-MM-DD] - [Day Title] - [Transport: driving/transit/walking]
[Brief day description]

**[Place Name 1]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

**[Place Name 2]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

DAY 2 - [Date: YYYY-MM-DD] - [Day Title] - [Transport: driving/transit/walking]
[Brief day description]

**[Place Name 3]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

Continue this format for all ${totalDays} days.

Requirements:
- Include 3-5 places and attractions per day
- Include only the place name itself with no other additions
- Don't include transportation options unless the transport itself is the attraction
- Day title should be up to 4 words
- Don't include alternative routes or options
- Match the activities to the interests of the traveler, the season and whether at the time of the year
- Consider travel time between locations and places that might be closed at the time of the year or on the specific day
- Each day should have a thematic focus when possible
- IMPORTANT: Each day header must end with "Transport: [mode]" where mode is driving, transit, or walking
- For each place, provide a description in a narrative style that shows why the specific traveller would want to visit it, what can they expect to do there and a bit of interesting cultural and historical background about the place. 
- Write in a tourist guide style. Start paragraph with 2nd person language always start with a verb ("discover the old city..., hike to the top..."), avoid reapting the same language. 
- Paragraphs should be no more than 25 words for a day and no more than 40 words for a place
- In each place description, include the place name (either the full name or a shortened version if appropriate) surrounded by **double asterisks** within the paragraph text. This name will be used for interactive linking and should be the most recognizable name for the place
- For each day, provide an intro with the theme of the day and the types of activies and possibly some historical background (depending on and subject to the travelers interests)
- The title of at least the first day should include the name of the region or city, surrounded by ** (for example: **Rome**). Each consecutive day concerning a new city or region should also include this formatting
- Each day should also have a region context - if you move to a new city or region, mention it clearly in the day title with the **RegionName** format
- traveler's interests: ${interests.join(", ")}
- Match the ${travelStyle} budget and style
- Provide realistic latitude and longitude coordinates (5 decimal places)
- Each place name must be wrapped in **double asterisks**
- Include specific place names (restaurants, museums, attractions, etc.)
- Provide practical, actionable recommendations. You can include practical tips about going from place to place (if not trivial) and about opening hours and other practical matters, as long as they are short. For hikings and walking trips include walking time and difficulty.
- Do not include any blocks other than days and places`;
}

function getTransportInstructions(transportPreference?: string): string {
  switch (transportPreference) {
    case "auto":
      return "Determine the best transport mode for each day (driving/transit/walking) based on the destination, distances, and activities. Specify the chosen transport mode in each day header.";
    case "driving":
      return "Use driving/car transport for all days. Plan for longer distances and car-accessible attractions.";
    case "transit":
      return "Use public transportation (bus, train, metro, tram) for all days. Focus on transit-accessible locations.";
    case "walking":
      return "Plan for walking transport only. Keep activities within walking distance and include walking times.";
    default:
      return "Determine the best transport mode for each day (driving/transit/walking) based on the destination, distances, and activities. Specify the chosen transport mode in each day header.";
  }
}

export interface PlaceDescriptionContext {
  placeName: string;
  placeAddress?: string;
  dayContext: {
    dayNumber: number;
    dayTitle: string;
    dayDate: string;
    existingPlaces: Array<{
      name: string;
      address?: string;
    }>;
  };
  travelStyle: string;
  interests: string[];
  destination: string;
}

export function createPlaceDescriptionPrompt(
  context: PlaceDescriptionContext
): string {
  const {
    placeName,
    placeAddress,
    dayContext,
    travelStyle,
    interests,
    destination,
  } = context;

  const existingPlacesText =
    dayContext.existingPlaces.length > 0
      ? `Other places already planned for this day: ${dayContext.existingPlaces
          .map((p) => p.name)
          .join(", ")}`
      : "This is the first place planned for this day";

  return `Create a travel description for a specific place in an itinerary.

PLACE TO DESCRIBE: ${placeName}${placeAddress ? ` (${placeAddress})` : ""}

CONTEXT:
- Destination: ${destination}
- Day ${dayContext.dayNumber}: ${dayContext.dayTitle} (${dayContext.dayDate})
- ${existingPlacesText}
- Travel Style: ${travelStyle}
- Traveler Interests: ${interests.join(", ")}

Create a compelling description for this place that:
- Explains why this specific traveler would want to visit it
- Describes what they can expect to do there
- Includes interesting cultural and historical background
- Uses 2nd person language starting with a verb ("Discover the ancient...", "Wander through...")
- Is written in a tourist guide style
- Is no more than 80 words
- Includes the place name ${placeName} (or shortened version) surrounded by **double asterisks** within the text
- Matches the ${travelStyle} travel style
- Appeals to someone interested in: ${interests.join(", ")}

Format: Return ONLY the description paragraph, no additional formatting or explanations.`;
}

/**
 * Create enriched itinerary prompt with Wikipedia data
 * This is step 3 of the multi-step generation process
 */
export interface EnrichedPlaceData {
  name: string;
  lat: number;
  lng: number;
  activities: string;
  time: string;
  wikipediaDescription?: string;
  interestingFacts?: string[];
}

export interface EnrichedDayData {
  dayNumber: number;
  date: string;
  title: string;
  transportMode: string;
  places: EnrichedPlaceData[];
}

export function createEnrichedItineraryPrompt({
  destination,
  title,
  enrichedDays,
  interests,
  travelStyle,
}: {
  destination: string;
  title: string;
  enrichedDays: EnrichedDayData[];
  interests: string[];
  travelStyle: string;
}): string {
  const daysText = enrichedDays
    .map((day) => {
      const placesText = day.places
        .map((place) => {
          let placeInfo = `**${place.name}** (lat: ${place.lat}, lng: ${place.lng})
Activities: ${place.activities}
Time: ${place.time}`;

          if (place.wikipediaDescription || place.interestingFacts) {
            placeInfo += `\n\nEnrichment Data:`;
            if (place.wikipediaDescription) {
              placeInfo += `\nDescription: ${place.wikipediaDescription}`;
            }
            if (place.interestingFacts && place.interestingFacts.length > 0) {
              placeInfo += `\nInteresting Facts:\n${place.interestingFacts
                .map((f) => `- ${f}`)
                .join("\n")}`;
            }
          }

          return placeInfo;
        })
        .join("\n\n");

      return `DAY ${day.dayNumber} - ${day.date} - ${day.title} - Transport: ${day.transportMode}

${placesText}`;
    })
    .join("\n\n");

  return `Create a rich, detailed travel itinerary for ${destination} based on the following skeleton plan with enriched information.

TITLE: ${title}

SKELETON PLAN WITH ENRICHMENT DATA:
${daysText}

NOTE: The "Enrichment Data" for each place includes a description and interesting facts. These facts come from either Wikipedia (if a matching article was found) or from the initial skeleton generation (as fallback). Use this enrichment data to create compelling narratives.

Transform this skeleton into a complete, engaging itinerary following these requirements:

FORMAT (EXACT):
ITINERARY TITLE: ${title}

DAY X - [Date: YYYY-MM-DD] - [Day Title] - [Transport: mode]
[Brief day description with theme and context]

**[Place Name]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Rich narrative paragraph about the place]

REQUIREMENTS:
- For each day, write a brief intro (max 25 words) with the theme and historical context
- For each place, write a compelling paragraph (max 40 words) that:
  * Uses 2nd person language starting with a verb
  * Incorporates the enrichment data provided (description and interesting facts)
  * Weaves in the interesting facts naturally into the narrative
  * Explains why this traveler would enjoy it based on interests: ${interests.join(
    ", "
  )}
  * Written in tourist guide style
  * Includes the place name in **double asterisks** within the paragraph
- Match the ${travelStyle} travel style
- Keep coordinates exactly as provided
- Include region markers (**RegionName**) when moving to new cities/regions
- Do not include any blocks other than days and places
- Write in an engaging, narrative style while being concise`;
}
