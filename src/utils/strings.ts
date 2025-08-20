/**
 * Clean an AI generated string by removing and decoding and delimitersspecial characters and replacing multiple spaces with a single space
 * @param str - The string to clean
 * @returns The cleaned string
 */
export function cleanString(str: string | undefined): string | undefined {
  if (!str || str === "") return str;
  return str
    .replace("&amp;", "&")
    .replace("**", "")
    .replace('"', "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}
