export function normalizeArticleContent(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.replace(/\n{3,}/g, "\n\n").trim();
}
