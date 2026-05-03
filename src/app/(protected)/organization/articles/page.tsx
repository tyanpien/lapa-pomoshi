"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../organization.module.css";
import {
  addOrganizationArticle,
  getOrganizationArticles,
  getOrganizationCabinetEventName,
  toggleOrganizationArticleArchive,
} from "@/shared/lib/organizationCabinet";
import { mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

export default function OrganizationArticlesPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [title, setTitle] = useState("");
  const [articleType, setArticleType] = useState("другое");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [localArticles, setLocalArticles] = useState(getOrganizationArticles());

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const sync = () => setLocalArticles(getOrganizationArticles());
    sync();
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);

  const articles = useMemo(
    () => mergeApiFirstById(apiPayload.apiArticles, localArticles),
    [apiPayload.apiArticles, localArticles]
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addOrganizationArticle({
      title: title.trim(),
      articleType,
      author: author.trim() || "Организация",
      content: content.trim(),
      coverUrl: coverUrl.trim() || undefined,
    });
    setTitle("");
    setArticleType("другое");
    setAuthor("");
    setContent("");
    setCoverUrl("");
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
                  <option value="уход">Уход</option>
                  <option value="первая помощь">Первая помощь</option>
                  <option value="адаптация">Адаптация</option>
                  <option value="социализация">Социализация</option>
                  <option value="воспитание">Воспитание</option>
                  <option value="лечение">Лечение</option>
                  <option value="юридические вопросы">Юридические вопросы</option>
                  <option value="другое">Другое</option>
                </select>
              </label>
              <label className={styles.label}>
                Автор
                <input className={styles.input} value={author} onChange={(e) => setAuthor(e.target.value)} />
              </label>
              <label className={styles.label}>
                Обложка (URL)
                <input className={styles.input} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
              </label>
            </div>
            <label className={styles.label}>
              Содержание
              <textarea
                className={styles.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
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
          {articles.length === 0 ? (
            <p className={styles.empty}>Пока нет созданных статей.</p>
          ) : (
            <div className={styles.list}>
              {articles.map((article) => (
                <article key={article.id} className={styles.animalCard}>
                  {article.coverUrl && <img src={article.coverUrl} alt={article.title} />}
                  <div className={styles.animalInfo}>
                    <h3 className={styles.animalName}>{article.title}</h3>
                    <p className={styles.metaLine}>
                      {article.articleType} • {article.author}
                    </p>
                    <p className={styles.animalMeta}>{article.content}</p>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>{article.archived ? "Архив" : "Опубликовано"}</span>
                    </div>
                    <div className={styles.actions}>
                      {!apiPayload.apiArticleIds.has(article.id) ? (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => toggleOrganizationArticleArchive(article.id)}
                        >
                          {article.archived ? "Вернуть из архива" : "В архив"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
