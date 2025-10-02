/**
 * Converts markdown-style bold syntax (**text**) to HTML bold tags (<b>text</b>)
 * for use in EditorJS paragraph blocks
 *
 * @param text - The text containing **bold** markdown syntax
 * @returns The text with <b> HTML tags instead of ** markers
 *
 * @example
 * convertMarkdownBoldToHtml("Visit **Eiffel Tower** in Paris")
 * // Returns: "Visit <b>Eiffel Tower</b> in Paris"
 */
export function convertMarkdownBoldToHtml(text: string): string {
  if (!text) return text;

  // Replace **text** with <b>text</b>
  // This regex matches text between ** markers that doesn't contain **
  return text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}
