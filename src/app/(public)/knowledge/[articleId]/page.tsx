"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { knowledgeApi, KnowledgeItem } from "@/shared/api/endpoints/knowledge";

export default function ArticlePage() {
  const params = useParams();
  const articleId = Number(params.articleId);

  const [article, setArticle] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    knowledgeApi.getById(articleId)
      .then(data => {
        setArticle(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [articleId]);

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  if (!article) {
    return (
      <div className={styles.notFound}>
        <h2>Статья не найдена</h2>
        <Link href="/knowledge">← Назад</Link>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.breadcrumbs}>
          <Link href="/">Главная</Link>
          <span>/</span>
          <Link href="/knowledge">База знаний</Link>
          <span>/</span>
          <span>{article.title}</span>
        </div>

        <div className={styles.header}>
          <span className={styles.category}>{article.category_label}</span>
          <h1 className={styles.title}>{article.title}</h1>

          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <img src="/clock.svg" className={styles.metaIcon} alt="" />
              <span>{article.read_minutes} мин чтения</span>
            </div>
          </div>
        </div>

        <div className={styles.content}>
          {article.content}
        </div>

        <Link href="/knowledge" className={styles.backLink}>
          ← Все статьи
        </Link>
      </div>
    </main>
  );
}
