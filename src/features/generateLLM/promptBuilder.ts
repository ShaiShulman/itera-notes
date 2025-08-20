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
- Include 3-5 places and attractions per day
- Include only the place name itself with no other additions
- Don't include transportation options unless the transport itself is the attraction
- Day title should be up to 4 words
- Don't include alternative routes or options
- match the activities to the interests of the traveler, the season and whether at the time of the year
- Consider travel time between locations and places that might be closed at the time of the year or on the specific day
- Each day should have a thematic focus when possible
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
