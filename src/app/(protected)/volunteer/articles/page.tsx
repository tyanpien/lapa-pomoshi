"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { volunteersApi, type VolunteerPublicArticleCard } from "@/shared/api/endpoints/volunteers";
import { knowledgeApi } from "@/shared/api/endpoints/knowledge";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { useUser } from "@/shared/lib/hooks/useUser";
import {
  readLinkedVolunteerCatalogUserId,
  syncVolunteerCatalogUserId,
  volunteerProfileStorageIdentity,
} from "@/shared/lib/volunteerProfileStorage";
import { getArticleCategoryLabel } from "@/shared/lib/articleCategoryLabels";

type ArticleFilter = "all" | string;

type ArticleForm = {
  title: string;
  articleType: string;
  summary: string;
  content: string;
};

const emptyForm: ArticleForm = {
  title: "",
  articleType: "care",
  summary: "",
  content: "",
};

const FALLBACK_CATEGORIES = [
  { id: "care", label: "Уход" },
  { id: "first_aid", label: "Первая помощь" },
  { id: "adaptation", label: "Адаптация" },
  { id: "socialization", label: "Социализация" },
  { id: "training", label: "Воспитание" },
  { id: "treatment", label: "Лечение" },
  { id: "legal", label: "Юридические вопросы" },
];

export default function VolunteerArticlesPage() {
  const { userName, userEmail } = useUser();
  const profileIdentity = useMemo(() => volunteerProfileStorageIdentity(userEmail, userName), [userEmail, userName]);
  const [articles, setArticles] = useState<VolunteerPublicArticleCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ArticleFilter>("all");
  const [errorText, setErrorText] = useState("");
  const [catalogs, setCatalogs] = useState(FALLBACK_CATEGORIES);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArticleForm>(emptyForm);

  const loadArticles = useCallback(async () => {
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
        setArticles([]);
        setErrorText("Не удалось определить профиль волонтера.");
        return;
      }

      const detail = await volunteersApi.getById(volunteerId);
      setArticles(detail.articles ?? []);
    } catch {
      setArticles([]);
      setErrorText("Не удалось загрузить статьи из API.");
    } finally {
      setIsLoading(false);
    }
  }, [profileIdentity]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    void knowledgeApi
      .getCatalogs()
      .then((cats) => {
        const categories = (cats.categories ?? []).filter((c) => c.id !== "all");
        if (categories.length > 0) {
          setCatalogs(categories);
        }
      })
      .catch(() => {
        setCatalogs(FALLBACK_CATEGORIES);
      });
  }, []);

  const categoryLabel = useCallback(
    (categoryId: string) => {
      const fromCatalog = catalogs.find((c) => c.id === categoryId)?.label;
      return fromCatalog ?? getArticleCategoryLabel(categoryId);
    },
    [catalogs]
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(articles.map((article) => article.category).filter(Boolean)));
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
      const byCategory = activeFilter === "all" || article.category === activeFilter;
      return bySearch && byCategory;
    });
  }, [activeFilter, articles, search]);

  const openCreateModal = () => {
    const first = catalogs[0]?.id ?? "care";
    setCreateForm({ ...emptyForm, articleType: first });
    setCreateModalOpen(true);
  };

  const buildPayload = (form: ArticleForm) => ({
    title: form.title.trim(),
    summary: (form.summary.trim() || form.content.trim().slice(0, 200)).trim(),
    content: form.content.trim(),
    category: form.articleType,
    is_context_tip: false,
    is_published: true,
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim() || createForm.content.trim().length < 10) return;
    void knowledgeApi
      .create(buildPayload(createForm))
      .then(() => {
        setCreateModalOpen(false);
        setCreateForm(emptyForm);
        return loadArticles();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать статью."));
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.topRow}>
            <h1 className={styles.title}>Мои статьи</h1>
            <button type="button" className={styles.addBtn} onClick={openCreateModal}>
              + Добавить статью
            </button>
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
                  {category === "all" ? "Все" : categoryLabel(category)}
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
              <Link key={article.id} href={`/knowledge/${article.id}`} className={styles.articleLink}>
                <article className={styles.requestCard}>
                  <div className={styles.cover}>
                    <img src="/knowledge.png" alt="" />
                  </div>

                  <div className={styles.requestBody}>
                    <h3 className={styles.requestName}>{article.title}</h3>
                    <div className={styles.tags}>
                      <span>{categoryLabel(article.category)}</span>
                      <span>{article.read_minutes} мин</span>
                    </div>
                    <p className={styles.organizationLine}>{article.summary || "Без описания"}</p>
                  </div>
                </article>
              </Link>
            ))}
          </section>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Добавить статью</h2>
            <form className={styles.form} onSubmit={handleCreate}>
              <div className={styles.formGrid}>
                <label className={styles.label}>
                  Заголовок
                  <input
                    className={styles.input}
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    required
                  />
                </label>
                <label className={styles.label}>
                  Тип статьи
                  <select
                    className={styles.select}
                    value={createForm.articleType}
                    onChange={(e) => setCreateForm({ ...createForm, articleType: e.target.value })}
                  >
                    {catalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.labelFull}>
                  Краткое описание
                  <input
                    className={styles.input}
                    value={createForm.summary}
                    onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })}
                  />
                </label>
                <label className={styles.labelFull}>
                  Содержание
                  <textarea
                    className={styles.textarea}
                    value={createForm.content}
                    onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                    minLength={10}
                    required
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setCreateModalOpen(false)}>
                  Отмена
                </button>
                <button type="submit" className={styles.primaryButton}>
                  Опубликовать
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
