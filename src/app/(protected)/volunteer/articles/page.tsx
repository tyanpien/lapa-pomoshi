"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { volunteersApi, type VolunteerPublicArticleCard } from "@/shared/api/endpoints/volunteers";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  readLinkedVolunteerCatalogUserId,
  syncVolunteerCatalogUserId,
  volunteerProfileStorageIdentity,
} from "@/shared/lib/volunteerProfileStorage";

type ArticleFilter = "all" | string;

export default function VolunteerArticlesPage() {
  const { userName, userEmail } = useUser();
  const profileIdentity = useMemo(() => volunteerProfileStorageIdentity(userEmail, userName), [userEmail, userName]);
  const [articles, setArticles] = useState<VolunteerPublicArticleCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ArticleFilter>("all");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorText("");

      try {
        let volunteerId = readLinkedVolunteerCatalogUserId();
        if (!volunteerId && profileIdentity.trim()) {
          try {
            const prof = await meProfileApi.get();
            const linked = await syncVolunteerCatalogUserId(profileIdentity, { userId: prof.user.id });
            volunteerId = linked.catalogUserId;
          } catch {
            const linked = await syncVolunteerCatalogUserId(profileIdentity);
            volunteerId = linked.catalogUserId;
          }
        }

        if (!volunteerId) {
          if (!cancelled) {
            setArticles([]);
            setErrorText("Не удалось определить профиль волонтера.");
          }
          return;
        }

        const detail = await volunteersApi.getById(volunteerId);
        if (!cancelled) {
          setArticles(detail.articles ?? []);
        }
      } catch {
        if (!cancelled) {
          setArticles([]);
          setErrorText("Не удалось загрузить статьи из API.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profileIdentity]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(articles.map((article) => article.category_label).filter(Boolean)));
    return ["all", ...unique];
  }, [articles]);

  useEffect(() => {
    if (activeFilter !== "all" && !categories.includes(activeFilter)) {
      setActiveFilter("all");
    }
  }, [activeFilter, categories]);

  const visibleArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return articles.filter((article) => {
      const bySearch =
        !query ||
        article.title.toLowerCase().includes(query) ||
        (article.summary ?? "").toLowerCase().includes(query);
      const byCategory = activeFilter === "all" || article.category_label === activeFilter;
      return bySearch && byCategory;
    });
  }, [activeFilter, articles, search]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Мои статьи</h1>
          </div>

          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={styles.statusFilters}>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`${styles.filterButton} ${activeFilter === category ? styles.filterButtonActive : ""}`}
                  onClick={() => setActiveFilter(category)}
                >
                  {category === "all" ? "Все" : category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? <div className={styles.emptyState}>Загружаем статьи...</div> : null}
        {!isLoading && errorText ? <div className={styles.emptyState}>{errorText}</div> : null}
        {!isLoading && !errorText && visibleArticles.length === 0 ? (
          <div className={styles.emptyState}>Статей пока нет.</div>
        ) : null}

        {!isLoading && !errorText && visibleArticles.length > 0 ? (
          <section className={styles.list}>
            {visibleArticles.map((article) => (
              <article key={article.id} className={styles.requestCard}>
                <div className={styles.cover}>
                  <img src="/cat-placeholder.jpg" alt={article.title} />
                </div>

                <div className={styles.requestBody}>
                  <h3 className={styles.requestName}>{article.title}</h3>
                  <div className={styles.tags}>
                    <span>{article.category_label}</span>
                    <span>{article.read_minutes} мин</span>
                  </div>
                  <p className={styles.organizationLine}>{article.summary || "Без описания"}</p>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}
