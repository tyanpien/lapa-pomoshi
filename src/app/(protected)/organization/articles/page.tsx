"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { knowledgeApi, type KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { getOrganizationCabinetEventName } from "@/shared/lib/organizationCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

function notifyCabinetUpdated() {
  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
}
import {
  articleCategoriesForSelect,
  getArticleCategoryLabel,
} from "@/shared/lib/articleCategoryLabels";
import { normalizeArticleContent } from "@/shared/lib/articleContent";
import { hasKnowledgeMediaCover, resolveKnowledgeCoverSrc } from "@/shared/lib/knowledgeCover";
import { ArticleCoverPicker } from "@/shared/ui/ArticleCoverPicker/ArticleCoverPicker";

type VisibilityFilter = "all" | "archive";

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

type CoverDraft = {
  previewUrl: string | null;
  file: File | null;
};

const emptyCoverDraft: CoverDraft = { previewUrl: null, file: null };

type OrgArticleRow = KnowledgeItem & {
  is_archived: boolean;
  is_published: boolean;
  can_edit: boolean;
};

function mapOrgArticleRow(
  row: Record<string, unknown>,
  categoryLabel: (id: string) => string
): OrgArticleRow {
  const id = typeof row.id === "number" ? row.id : Number(row.id) || 0;
  const category = String(row.category ?? "care");
  const authorUserId =
    typeof row.author_user_id === "number" ? row.author_user_id : Number(row.author_user_id) || null;
  return {
    id,
    title: String(row.title ?? ""),
    summary: row.summary != null ? String(row.summary) : "",
    content: "",
    category,
    category_label: categoryLabel(category),
    read_minutes: typeof row.read_minutes === "number" ? row.read_minutes : Number(row.read_minutes) || 0,
    is_context_tip: false,
    created_at: String(row.created_at ?? new Date().toISOString()),
    author_user_id: authorUserId,
    is_archived: Boolean(row.is_archived),
    is_published: row.is_published !== false,
    can_edit: row.can_edit === true,
    cover_url: row.cover_url != null ? String(row.cover_url) : null,
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
  const { isLoading: isUserLoading } = useUser();
  const [articles, setArticles] = useState<OrgArticleRow[]>([]);
  const [catalogs, setCatalogs] = useState<{ id: string; label: string }[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const loadGenerationRef = useRef(0);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArticleForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ArticleForm>(emptyForm);
  const [editLoading, setEditLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createCover, setCreateCover] = useState<CoverDraft>(emptyCoverDraft);
  const [editCover, setEditCover] = useState<CoverDraft>(emptyCoverDraft);

  const categoryLabel = useCallback(
    (id: string) => catalogs.find((c) => c.id === id)?.label ?? getArticleCategoryLabel(id),
    [catalogs]
  );

  const reload = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setErrorText("");
    try {
      const [cats, profile, rawArticles] = await Promise.all([
        knowledgeApi.getCatalogs(),
        meProfileApi.get().catch(() => null),
        meOrganizationApi.listArticles(),
      ]);
      if (generation !== loadGenerationRef.current) return;

      const rawCategories = cats.categories?.length ? cats.categories : FALLBACK_CATEGORIES;
      const categories = articleCategoriesForSelect(rawCategories);
      setCatalogs(categories.length > 0 ? categories : FALLBACK_CATEGORIES);
      const labelMap = new Map(rawCategories.map((c) => [c.id, c.label]));
      const currentUserId = profile?.user?.id ?? null;

      const rows = unwrapApiList<Record<string, unknown>>(rawArticles);
      setArticles(
        rows
          .map((row) => mapOrgArticleRow(row, (id) => labelMap.get(id) ?? id))
          .filter((a) => {
            if (a.id <= 0 || !a.can_edit) return false;
            if (currentUserId == null) return true;
            return a.author_user_id == null || a.author_user_id === currentUserId;
          })
      );
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      setArticles([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить статьи.");
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (isUserLoading) return;
    void reload();
  }, [isUserLoading, reload]);

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
    setCreateCover(emptyCoverDraft);
    setCreateModalOpen(true);
  };

  const buildPayload = (form: ArticleForm) => {
    const category =
      form.articleType.trim().toLowerCase() === "all"
        ? catalogs[0]?.id ?? "care"
        : form.articleType;
    return {
    title: form.title.trim(),
    summary: (form.summary.trim() || form.content.trim().slice(0, 200)).trim(),
    content: normalizeArticleContent(form.content),
    category,
    is_context_tip: false,
    is_published: true,
  };
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim() || createForm.content.trim().length < 10) return;
    void knowledgeApi
      .create(buildPayload(createForm))
      .then(async (created) => {
        if (createCover.file) {
          await knowledgeApi.uploadCover(created.id, createCover.file);
        }
        setCreateModalOpen(false);
        setCreateForm(emptyForm);
        setCreateCover(emptyCoverDraft);
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать статью."));
  };

  const openEditModal = (article: OrgArticleRow) => {
    if (!article.can_edit) {
      setErrorText("Редактировать можно только свои статьи.");
      return;
    }
    setEditId(article.id);
    setEditLoading(true);
    void knowledgeApi
      .getById(article.id)
      .then((d) => {
        if (d.can_edit === false) {
          setErrorText("Редактировать можно только свои статьи.");
          setEditId(null);
          return;
        }
        const editCategory = d.category ?? article.category;
        setEditForm({
          title: d.title,
          summary: d.summary ?? "",
          content: d.content ?? "",
          articleType:
            editCategory.trim().toLowerCase() === "all"
              ? catalogs[0]?.id ?? "care"
              : editCategory,
        });
        const coverSrc = d.cover_url?.trim();
        setEditCover({
          previewUrl: hasKnowledgeMediaCover(coverSrc) ? resolveKnowledgeCoverSrc(coverSrc) : null,
          file: null,
        });
      })
      .catch(() => setErrorText("Не удалось загрузить статью."))
      .finally(() => setEditLoading(false));
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editId === null || editForm.content.trim().length < 10) return;
    const articleId = editId;
    void knowledgeApi
      .patch(articleId, buildPayload(editForm))
      .then(async () => {
        if (editCover.file) {
          await knowledgeApi.uploadCover(articleId, editCover.file);
        }
        notifyCabinetUpdated();
        return reload();
      })
      .then(() => {
        setEditId(null);
        setEditCover(emptyCoverDraft);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "";
        setErrorText(
          msg.includes("403") || /edit own|own article/i.test(msg)
            ? "Редактировать можно только свои статьи."
            : "Превышен лимит краткого описания статьи"
        );
      });
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
    onCancel: () => void,
    cover: CoverDraft,
    onCoverChange: (file: File | null, previewUrl: string | null) => void
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
        <div className={styles.labelFull}>
          <ArticleCoverPicker
            previewUrl={cover.previewUrl}
            onFileSelect={(file, previewUrl) => onCoverChange(file, previewUrl)}
          />
        </div>
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
                {article.can_edit ? (
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
                ) : null}
              </article>
            ))}
          </section>
        ) : null}
      </div>

      {isCreateModalOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setCreateModalOpen(false)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Добавить статью</h2>
            {renderForm(
              createForm,
              setCreateForm,
              handleCreate,
              "Опубликовать",
              () => setCreateModalOpen(false),
              createCover,
              (file, previewUrl) => setCreateCover({ file, previewUrl })
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
              renderForm(
                editForm,
                setEditForm,
                handleEdit,
                "Сохранить",
                () => {
                  setEditId(null);
                  setEditCover(emptyCoverDraft);
                },
                editCover,
                (file, previewUrl) => setEditCover({ file, previewUrl })
              )
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
