"use client";

import styles from "./page.module.css";

export type ResponseDescriptionFields = {
  descriptionSnippet: string;
  descriptionFull: string | null;
};

const PREVIEW_MAX_CHARS = 220;
const LONG_SINGLE_SENTENCE_CHARS = 260;

function normalizeForCompare(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function splitIntoSentences(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?…])(?:\s+|$)/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function previewCollapseText(text: string, maxChars = PREVIEW_MAX_CHARS): string {
  const t = text.trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  const slice = t.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 48 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

export function firstTwoSentencesPreview(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const sentences = splitIntoSentences(t);
  if (sentences.length >= 3) {
    return `${sentences[0]} ${sentences[1]}`.trim();
  }
  if (sentences.length === 2) {
    return t;
  }
  const single = sentences[0] ?? t;
  if (single.length > LONG_SINGLE_SENTENCE_CHARS) {
    return previewCollapseText(single);
  }
  return t;
}

export function fullBodyText(item: ResponseDescriptionFields): string {
  const full = item.descriptionFull?.trim();
  if (full) return full;
  return item.descriptionSnippet?.trim() || "";
}

export function collapsePreviewText(item: ResponseDescriptionFields): string {
  return firstTwoSentencesPreview(fullBodyText(item));
}

function looksLikeTruncatedSnippet(snippet: string): boolean {
  const sn = snippet.trim();
  if (!sn) return false;
  if (sn.length >= 140) return true;
  if (/[…]|\.\.\.\s*$/.test(sn)) return true;
  if (sn.includes("\n\n")) return true;
  return false;
}

export function needsReadMoreToggle(item: ResponseDescriptionFields): boolean {
  const body = fullBodyText(item);
  if (!body) return false;
  const preview = firstTwoSentencesPreview(body);
  if (normalizeForCompare(preview) !== normalizeForCompare(body)) {
    return true;
  }
  if (!item.descriptionFull?.trim() && looksLikeTruncatedSnippet(item.descriptionSnippet)) {
    return true;
  }
  return false;
}

function FormattedDescription({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const blocks = trimmed.split(/\n{2,}/);
  return (
    <div className={styles.formattedDesc}>
      {blocks.map((block, i) => (
        <p key={i} className={styles.descBlock}>
          {block.trim()}
        </p>
      ))}
    </div>
  );
}

type ResponseCardDescriptionProps = {
  item: ResponseDescriptionFields;
  expanded: boolean;
  loadingDetail: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  stopPropagationOnToggle?: boolean;
};

export function ResponseCardDescription({
  item,
  expanded,
  loadingDetail,
  onExpand,
  onCollapse,
  stopPropagationOnToggle,
}: ResponseCardDescriptionProps) {
  const toggle = needsReadMoreToggle(item);
  const preview = collapsePreviewText(item);
  const body = fullBodyText(item);

  if (!body) {
    return null;
  }

  if (expanded) {
    return (
      <div className={styles.descArea}>
        <FormattedDescription text={body} />
        <div className={styles.descToggleRow}>
          <button
            type="button"
            className={styles.descToggle}
            onClick={(e) => {
              if (stopPropagationOnToggle) e.stopPropagation();
              onCollapse();
            }}
          >
            Меньше
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.descArea}>
      <div className={styles.descCollapsedRow}>
        <p className={styles.descPreview}>{preview}</p>
        {toggle ? (
          <button
            type="button"
            className={styles.descToggle}
            onClick={(e) => {
              if (stopPropagationOnToggle) e.stopPropagation();
              onExpand();
            }}
            disabled={loadingDetail}
          >
            {loadingDetail ? "Загрузка…" : "Подробнее"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
