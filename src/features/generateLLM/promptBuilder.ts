export function createItineraryPrompt({
  destination,
  startDate,
  endDate,
  totalDays,
  interests,
  travelStyle,
  additionalNotes,
}: {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  interests: string[];
  travelStyle: string;
  additionalNotes?: string;
}): string {
  return `Create a detailed ${totalDays}-day travel itinerary for ${destination} from ${startDate} to ${endDate}.

Travel Style: ${travelStyle}
Interests: ${interests.join(", ")}
${additionalNotes ? `Additional Notes: ${additionalNotes}` : ""}

Please format your response EXACTLY as follows:

ITINERARY TITLE: [Creative title for the trip]

DAY 1 - [Date: YYYY-MM-DD] - [Day Title]
[Brief day description]

**[Place Name 1]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

**[Place Name 2]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

DAY 2 - [Date: YYYY-MM-DD] - [Day Title]
[Brief day description]

**[Place Name 3]** (lat: XX.XXXXX, lng: XX.XXXXX)
[Description of the place and activities]

Continue this format for all ${totalDays} days.

Requirements:
- Include 2-4 places per day
- Provide realistic latitude and longitude coordinates (5 decimal places)
- Each place name must be wrapped in **double asterisks**
- Include specific place names (restaurants, museums, attractions, etc.)
- Consider travel time between locations
- Match the ${travelStyle} budget and style
- Focus on the traveler's interests: ${interests.join(", ")}
- Provide practical, actionable recommendations
- Include opening hours and practical tips when relevant
- Each day should have a thematic focus when possible`;
}
