"use client";

import Link from "next/link";
import type { KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import {
  pickRelevantKnowledgeTips,
  taskQualifiesForKnowledgeTips,
  type TaskForKnowledgeTips,
} from "@/shared/lib/volunteerTaskKnowledgeTips";
import styles from "./TaskKnowledgeTips.module.css";

type Props = {
  task: TaskForKnowledgeTips;
  tips: KnowledgeItem[];
  className?: string;
};

export function TaskKnowledgeTips({ task, tips, className }: Props) {
  if (!taskQualifiesForKnowledgeTips(task)) {
    return null;
  }

  const relevant = pickRelevantKnowledgeTips(tips, task);
  if (!relevant.length) {
    return null;
  }

  return (
    <aside className={[styles.block, className].filter(Boolean).join(" ")} aria-label="Подсказки из базы знаний">
      <p className={styles.title}>
        <img src="/info.svg" alt="" aria-hidden className={styles.icon} />
        Полезно перед задачей
      </p>
      <ul className={styles.list}>
        {relevant.map((tip) => (
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
