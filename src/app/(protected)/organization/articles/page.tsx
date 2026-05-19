"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { knowledgeApi, type KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { getOrganizationCabinetEventName } from "@/shared/lib/organizationCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

function notifyCabinetUpdated() {
  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
}
import { getArticleCategoryLabel } from "@/shared/lib/articleCategoryLabels";

type VisibilityFilter = "all" | "archive";

type OrgArticleRow = KnowledgeItem & {
  is_archived: boolean;
  is_published: boolean;
};

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
];

function mapMeArticleRow(
  row: Record<string, unknown>,
  categoryLabel: (id: string) => string
): OrgArticleRow {
  const id = typeof row.id === "number" ? row.id : Number(row.id) || 0;
  const category = String(row.category ?? "care");
  return {
    id,
    title: String(row.title ?? ""),
    summary: "",
    content: undefined,
    category,
    category_label: categoryLabel(category),
    read_minutes: typeof row.read_minutes === "number" ? row.read_minutes : 0,
    is_context_tip: false,
    created_at: String(row.created_at ?? new Date().toISOString()),
    is_archived: Boolean(row.is_archived),
    is_published: row.is_published !== false,
  };
}

function mapPublicArticle(item: KnowledgeItem): OrgArticleRow {
  return {
    ...item,
    is_archived: false,
    is_published: true,
  };
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function OrganizationArticlesPage() {
  const { role } = useUser();
  const [articles, setArticles] = useState<OrgArticleRow[]>([]);
  const [catalogs, setCatalogs] = useState<{ id: string; label: string }[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArticleForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ArticleForm>(emptyForm);
  const [editLoading, setEditLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const categoryLabel = useCallback(
    (id: string) => catalogs.find((c) => c.id === id)?.label ?? getArticleCategoryLabel(id),
    [catalogs]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const cats = await knowledgeApi.getCatalogs();
      const categories = cats.categories?.length ? cats.categories : FALLBACK_CATEGORIES;
      setCatalogs(categories);
      const labelMap = new Map(categories.map((c) => [c.id, c.label]));

      if (role === "organization") {
        const raw = await meOrganizationApi.listArticles();
        const rows = unwrapApiList<Record<string, unknown>>(raw);
        setArticles(
          rows
            .map((row) => mapMeArticleRow(row, (id) => labelMap.get(id) ?? id))
            .filter((a) => a.id > 0)
        );
        return;
      }

      const list = await knowledgeApi.getList();
      setArticles((list.items ?? []).map(mapPublicArticle));
    } catch (e) {
      setArticles([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить статьи.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleArticles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return articles
      .filter((item) => (visibilityFilter === "archive" ? item.is_archived : !item.is_archived))
      .filter((item) => {
        if (!query) return true;
        const haystack = [item.title, item.summary, item.category_label, item.content ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
  }, [articles, search, visibilityFilter]);

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
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать статью."));
  };

  const openEditModal = (article: OrgArticleRow) => {
    setEditId(article.id);
    setEditLoading(true);
    void knowledgeApi
      .getById(article.id)
      .then((d) => {
        setEditForm({
          title: d.title,
          summary: d.summary ?? "",
          content: d.content ?? "",
          articleType: d.category ?? article.category,
        });
      })
      .catch(() => setErrorText("Не удалось загрузить статью."))
      .finally(() => setEditLoading(false));
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editId === null || editForm.content.trim().length < 10) return;
    void knowledgeApi
      .patch(editId, buildPayload(editForm))
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .then(() => setEditId(null))
      .catch(() => setErrorText("Не удалось сохранить статью."));
  };

  const handleArchive = (id: number) => {
    setBusyId(id);
    void knowledgeApi
      .archive(id)
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch(() => setErrorText("Не удалось отправить статью в архив."))
      .finally(() => setBusyId(null));
  };

  const handleDelete = (id: number) => {
    const ok = window.confirm("Удалить статью безвозвратно?");
    if (!ok) return;
    setBusyId(id);
    void knowledgeApi
      .delete(id)
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch(() => setErrorText("Не удалось удалить статью."))
      .finally(() => setBusyId(null));
  };

  const renderForm = (
    form: ArticleForm,
    setForm: (next: ArticleForm) => void,
    onSubmit: (e: FormEvent<HTMLFormElement>) => void,
    submitLabel: string,
    onCancel: () => void
  ) => (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <label className={styles.label}>
          Заголовок
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label className={styles.label}>
          Тип статьи
          <select
            className={styles.select}
            value={form.articleType}
            onChange={(e) => setForm({ ...form, articleType: e.target.value })}
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
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
        </label>
        <label className={styles.labelFull}>
          Содержание
          <textarea
            className={styles.textarea}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            minLength={10}
            required
          />
        </label>
      </div>
      <div className={styles.modalActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className={styles.primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Статьи</h1>
              <p className={styles.subtitle}>
                Создавайте материалы для базы знаний: заголовок, тип статьи и содержание.
              </p>
            </div>
            <button type="button" className={styles.addBtn} onClick={openCreateModal}>
              + Добавить статью
            </button>
          </div>

          <div className={styles.toolbar}>
            <input
              className={styles.searchInput}
              placeholder="Найти"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              aria-label="Фильтр статей"
            >
              <option value="all">Все</option>
              <option value="archive">Архив</option>
            </select>
          </div>
        </div>

        {errorText ? <p className={styles.error}>{errorText}</p> : null}
        {loading ? <p className={styles.empty}>Загрузка…</p> : null}

        {!loading && visibleArticles.length === 0 ? (
          <p className={styles.empty}>
            {visibilityFilter === "archive" ? "В архиве пока нет статей." : "Пока нет созданных статей."}
          </p>
        ) : null}

        {!loading && visibleArticles.length > 0 ? (
          <section className={styles.list}>
            {visibleArticles.map((article) => (
              <article key={article.id} className={styles.itemCard}>
                <h2 className={styles.itemTitle}>{article.title}</h2>
                <p className={styles.metaLine}>
                  {categoryLabel(article.category)}
                  {article.read_minutes > 0 ? ` · ${article.read_minutes} мин чтения` : ""}
                </p>
                <p className={styles.metaLine}>Создано: {formatCreatedAt(article.created_at)}</p>
                {article.summary ? <p className={styles.summaryLine}>{article.summary}</p> : null}
                <div className={styles.badgeRow}>
                  <span
                    className={`${styles.badge} ${article.is_archived ? styles.badgeArchived : ""}`.trim()}
                  >
                    {article.is_archived ? "Архив" : "Опубликовано"}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    disabled={busyId === article.id}
                    onClick={() => openEditModal(article)}
                  >
                    Изменить
                  </button>
                  {!article.is_archived ? (
                    <button
                      type="button"
                      className={styles.archiveBtn}
                      disabled={busyId === article.id}
                      onClick={() => handleArchive(article.id)}
                    >
                      В архив
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={busyId === article.id}
                    onClick={() => handleDelete(article.id)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Добавить статью</h2>
            {renderForm(createForm, setCreateForm, handleCreate, "Опубликовать", () =>
              setCreateModalOpen(false)
            )}
          </div>
        </div>
      ) : null}

      {editId !== null ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setEditId(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Редактировать статью</h2>
            {editLoading ? (
              <p className={styles.empty}>Загрузка…</p>
            ) : (
              renderForm(editForm, setEditForm, handleEdit, "Сохранить", () => setEditId(null))
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
