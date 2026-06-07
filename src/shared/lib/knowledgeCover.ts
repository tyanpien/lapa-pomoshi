import { getImageUrl } from "@/shared/api/client";

export const DEFAULT_KNOWLEDGE_COVER_SRC = "/knowledge.png";

export function hasKnowledgeMediaCover(coverUrl?: string | null): boolean {
  const trimmed = coverUrl?.trim();
  if (!trimmed) return false;
  if (trimmed === DEFAULT_KNOWLEDGE_COVER_SRC || trimmed.endsWith("/knowledge.png")) {
    return false;
  }
  return true;
}

export function resolveKnowledgeCoverSrc(coverUrl?: string | null): string {
  if (!hasKnowledgeMediaCover(coverUrl)) {
    return DEFAULT_KNOWLEDGE_COVER_SRC;
  }
  const trimmed = coverUrl!.trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  return getImageUrl(trimmed);
}
