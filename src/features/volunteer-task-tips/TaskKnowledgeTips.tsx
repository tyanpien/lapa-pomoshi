"use client";

import Link from "next/link";
import type { KnowledgeHintItem } from "@/shared/api/endpoints/knowledge";
import styles from "./TaskKnowledgeTips.module.css";

export type TaskWithKnowledgeHints = {
  knowledge_hints?: KnowledgeHintItem[] | null;
};

type Props = {
  task: TaskWithKnowledgeHints;
  className?: string;
};

export function TaskKnowledgeTips({ task, className }: Props) {
  const tips = (task.knowledge_hints ?? []).filter(
    (tip) => (tip.title ?? "").trim() && (tip.summary ?? "").trim(),
  );

  if (!tips.length) {
    return null;
  }

  return (
    <aside className={[styles.block, className].filter(Boolean).join(" ")} aria-label="Подсказки из базы знаний">
      <p className={styles.title}>
        <img src="/info.svg" alt="" aria-hidden className={styles.icon} />
        Полезно перед задачей
      </p>
      <ul className={styles.list}>
        {tips.map((tip) => (
          <li key={tip.id}>
            <Link href={`/knowledge/${tip.id}`} className={styles.link}>
              <span className={styles.linkTitle}>{tip.title}</span>
              {tip.category_label ? (
                <span className={styles.category}>{tip.category_label}</span>
              ) : null}
              {tip.summary ? <span className={styles.summary}>{tip.summary}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
