export interface ParsedPlaceDescription {
  content: string;
  cleanedContent: string;
  error?: string;
}

export function parsePlaceDescriptionResponse(
  response: string
): ParsedPlaceDescription {
  console.log("📝 Parsing place description response:", {
    responseLength: response.length,
    firstChars: response.substring(0, 100),
  });

  try {
    // Clean the response by removing excessive whitespace and newlines
    let cleanedContent = response
      .trim()
      .replace(/\n\s*\n/g, "\n") // Remove multiple empty lines
      .replace(/^\s+|\s+$/gm, ""); // Trim each line

    // If the response is wrapped in quotes, remove them
    if (cleanedContent.startsWith('"') && cleanedContent.endsWith('"')) {
      cleanedContent = cleanedContent.slice(1, -1);
    }

    // Remove any markdown formatting that might interfere
    cleanedContent = cleanedContent
      .replace(/^\*\*(.+?)\*\*$/gm, "$1") // Remove **text** at start/end of lines
      .replace(/\*\*([^*]+)\*\*/g, "$1"); // Remove **text** inline

    return {
      content: response,
      cleanedContent: cleanedContent,
    };
  } catch (error) {
    console.error("❌ Error parsing place description:", error);

    return {
      content: response,
      cleanedContent: response.trim(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
