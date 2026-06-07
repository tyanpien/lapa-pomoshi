"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { knowledgeApi, KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { KnowledgeArticleCover } from "@/shared/ui/KnowledgeArticleCover/KnowledgeArticleCover";

export default function KnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      knowledgeApi.getList(),
      knowledgeApi.getCatalogs()
    ])
      .then(([list, catalogs]) => {
        setArticles(list.items || []);
        setCategories(catalogs.categories || []);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const filtered = articles.filter((a) => {
    return (
      a.title.toLowerCase().includes(search.toLowerCase()) &&
      (activeCategory === "all" || a.category === activeCategory)
    );
  });

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>База знаний</h1>

        <div className={styles.topBar}>
          <input
            placeholder="Найти"
            className={styles.search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className={styles.filters}>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`${styles.filterBtn} ${
                  activeCategory === c.id ? styles.active : ""
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.list}>
          {filtered.map((a) => (
            <Link href={`/knowledge/${a.id}`} key={a.id} className={styles.card}>
              <div className={styles.image}>
                <KnowledgeArticleCover coverUrl={a.cover_url} alt={a.title} />
              </div>

              <div className={styles.content}>
                <h3>{a.title}</h3>
                <p className={styles.summary}>{a.summary}</p>

                <div className={styles.meta}>
                  <span className={styles.time}>
                    <img src="/clock.svg" className={styles.clockIcon} alt="" />
                    {a.read_minutes} мин
                  </span>

                  <span className={styles.category}>
                    {a.category_label}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
