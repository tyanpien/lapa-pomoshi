"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "../organization.module.css";
import { knowledgeApi, type KnowledgeItem } from "@/shared/api/endpoints/knowledge";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

function mapMeArticleRow(row: Record<string, unknown>): KnowledgeItem {
  const id = typeof row.id === "number" ? row.id : Number(row.id) || 0;
  const content = row.content != null ? String(row.content) : "";
  return {
    id,
    title: String(row.title ?? ""),
    summary: String(row.summary ?? content).slice(0, 500),
    content: content || undefined,
    category: String(row.category ?? "care"),
    category_label: String(row.category_label ?? ""),
    read_minutes: typeof row.read_minutes === "number" ? row.read_minutes : 0,
    is_context_tip: Boolean(row.is_context_tip),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export default function OrganizationArticlesPage() {
  const { userName, role } = useUser();
  const [title, setTitle] = useState("");
  const [articleType, setArticleType] = useState("care");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [articles, setArticles] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [catalogs, setCatalogs] = useState<{ id: string; label: string }[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("care");
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (role === "organization") {
        return Promise.all([meOrganizationApi.listArticles(), knowledgeApi.getCatalogs()]).then(([raw, cats]) => {
          if (cancelled) return;
          const rows = unwrapApiList<Record<string, unknown>>(raw);
          setArticles(rows.map(mapMeArticleRow).filter((a) => a.id > 0));
          const c = cats.categories ?? [];
          setCatalogs(c);
          const first = c[0]?.id;
          if (first) {
            setArticleType((prev) => (c.some((x) => x.id === prev) ? prev : first));
          }
        });
      }
      return Promise.all([knowledgeApi.getList(), knowledgeApi.getCatalogs()]).then(([list, cats]) => {
        if (cancelled) return;
        const items = list.items ?? [];
        setArticles(items);
        const c = cats.categories ?? [];
        setCatalogs(c);
        const first = c[0]?.id;
        if (first) {
          setArticleType((prev) => (c.some((x) => x.id === prev) ? prev : first));
        }
      });
    };
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setErrorText("");
      void load()
        .catch((e) => {
          if (cancelled) return;
          setArticles([]);
          setErrorText(e instanceof Error ? e.message : "Не удалось загрузить статьи.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [userName, role]);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || content.trim().length < 10) return;
    void knowledgeApi
      .create({
        title: title.trim(),
        summary: (summary.trim() || content.trim().slice(0, 200)).trim(),
        content: content.trim(),
        category: articleType,
        is_context_tip: false,
        is_published: true,
      })
      .then(() => {
        setTitle("");
        setContent("");
        setSummary("");
        return knowledgeApi.getList();
      })
      .then((list) => setArticles(list.items ?? []))
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось создать статью."));
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Статьи</h1>
        <p className={styles.subtitle}>
          Создавайте материалы для базы знаний: заголовок, тип статьи, автор, содержание и обложка.
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Новая статья</h2>
          <form onSubmit={handleCreate}>
            <div className={styles.grid}>
              <label className={styles.label}>
                Заголовок
                <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className={styles.label}>
                Тип статьи
                <select
                  className={styles.select}
                  value={articleType}
                  onChange={(e) => setArticleType(e.target.value)}
                >
                  {catalogs.length > 0 ? (
                    catalogs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="care">Уход</option>
                      <option value="first_aid">Первая помощь</option>
                      <option value="adaptation">Адаптация</option>
                    </>
                  )}
                </select>
              </label>
              <label className={styles.label}>
                Краткое описание
                <input className={styles.input} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </label>
            </div>
            <label className={styles.label}>
              Содержание
              <textarea className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} minLength={10} required />
            </label>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton}>
                Опубликовать статью
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Мои статьи</h2>
          {loading ? (
            <p className={styles.empty}>Загрузка...</p>
          ) : errorText ? (
            <p className={styles.empty}>{errorText}</p>
          ) : articles.length === 0 ? (
            <p className={styles.empty}>Пока нет созданных статей.</p>
          ) : (
            <div className={styles.list}>
              {articles.map((article) => (
                <article key={article.id} className={styles.animalCard}>
                  <div className={styles.animalInfo}>
                    <h3 className={styles.animalName}>{article.title}</h3>
                    <p className={styles.metaLine}>{article.category_label}</p>
                    <p className={styles.animalMeta}>{article.summary}</p>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>Опубликовано</span>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                          setEditId(article.id);
                          setEditLoading(true);
                          void knowledgeApi
                            .getById(article.id)
                            .then((d) => {
                              setEditTitle(d.title);
                              setEditSummary(d.summary ?? "");
                              setEditContent(d.content ?? "");
                              setEditCategory(d.category ?? article.category);
                            })
                            .catch(() => setErrorText("Не удалось загрузить статью для редактирования."))
                            .finally(() => setEditLoading(false));
                        }}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() =>
                          void knowledgeApi.archive(article.id).then(() => knowledgeApi.getList()).then((l) => setArticles(l.items ?? [])).catch(() => {})
                        }
                      >
                        В архив
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() =>
                          void knowledgeApi.delete(article.id).then(() => knowledgeApi.getList()).then((l) => setArticles(l.items ?? [])).catch(() => {})
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editId !== null ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          role="presentation"
          onClick={() => setEditId(null)}
        >
          <div
            className={styles.card}
            style={{ maxWidth: 560, width: "90%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.cardTitle}>Редактирование</h2>
            {editLoading ? (
              <p>Загрузка…</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editContent.trim().length < 10) return;
                  void knowledgeApi
                    .patch(editId, {
                      title: editTitle.trim(),
                      summary: editSummary.trim() || null,
                      content: editContent.trim(),
                      category: editCategory,
                    })
                    .then(() => knowledgeApi.getList())
                    .then((l) => setArticles(l.items ?? []))
                    .then(() => setEditId(null))
                    .catch(() => setErrorText("Не удалось сохранить изменения."));
                }}
              >
                <label className={styles.label}>
                  Заголовок
                  <input className={styles.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </label>
                <label className={styles.label}>
                  Категория
                  <select className={styles.select} value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                    {(catalogs.length ? catalogs : [{ id: "care", label: "Уход" }]).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.label}>
                  Краткое описание
                  <input className={styles.input} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
                </label>
                <label className={styles.label}>
                  Содержание
                  <textarea className={styles.textarea} value={editContent} onChange={(e) => setEditContent(e.target.value)} minLength={10} required />
                </label>
                <div className={styles.actions}>
                  <button type="submit" className={styles.primaryButton}>
                    Сохранить
                  </button>
                  <button type="button" className={styles.secondaryButton} onClick={() => setEditId(null)}>
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
