"use client";

import {
  DEFAULT_KNOWLEDGE_COVER_SRC,
  resolveKnowledgeCoverSrc,
} from "@/shared/lib/knowledgeCover";

type KnowledgeArticleCoverProps = {
  coverUrl?: string | null;
  alt?: string;
  className?: string;
};

export function KnowledgeArticleCover({ coverUrl, alt = "", className }: KnowledgeArticleCoverProps) {
  const src = resolveKnowledgeCoverSrc(coverUrl);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.dataset.fallbackApplied === "1") return;
        img.dataset.fallbackApplied = "1";
        img.src = DEFAULT_KNOWLEDGE_COVER_SRC;
      }}
    />
  );
}
