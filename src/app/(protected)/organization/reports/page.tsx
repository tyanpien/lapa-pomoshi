"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "../organization.module.css";
import {
  addOrganizationReport,
  getOrganizationCabinetEventName,
  getOrganizationReports,
  toggleOrganizationReportArchive,
} from "@/shared/lib/organizationCabinet";
import { mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";
import { useOrganizationPublicCabinetPayload } from "@/shared/lib/hooks/useOrganizationPublicCabinetPayload";

export default function OrganizationReportsPage() {
  const apiPayload = useOrganizationPublicCabinetPayload();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [localReports, setLocalReports] = useState(getOrganizationReports());

  useEffect(() => {
    const eventName = getOrganizationCabinetEventName();
    const sync = () => setLocalReports(getOrganizationReports());
    sync();
    window.addEventListener(eventName, sync);
    return () => window.removeEventListener(eventName, sync);
  }, []);

  const reports = useMemo(
    () => mergeApiFirstById(apiPayload.apiReports, localReports),
    [apiPayload.apiReports, localReports]
  );

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    addOrganizationReport({
      title: title.trim(),
      content: content.trim(),
      isUrgent,
    });
    setTitle("");
    setContent("");
    setIsUrgent(false);
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Отчеты</h1>
        <p className={styles.subtitle}>
          Публикуйте отчеты о сборах, расходах и результатах помощи. Срочные отчеты отмечаются отдельной меткой.
        </p>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Новый отчет</h2>
          <form onSubmit={handleCreate}>
            <label className={styles.label}>
              Заголовок
              <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className={styles.label}>
              Текст отчета
              <textarea
                className={styles.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} />
              Срочный отчет
            </label>
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryButton}>
                Опубликовать отчет
              </button>
            </div>
          </form>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Мои отчеты</h2>
          {reports.length === 0 ? (
            <p className={styles.empty}>Отчеты пока не добавлены.</p>
          ) : (
            <div className={styles.list}>
              {reports.map((report) => (
                <article key={report.id} className={styles.animalCard}>
                  <div className={styles.animalInfo}>
                    <h3 className={styles.animalName}>{report.title}</h3>
                    <p className={styles.animalMeta}>{report.content}</p>
                    <div className={styles.badgeRow}>
                      {report.isUrgent && <span className={`${styles.badge} ${styles.badgeUrgent}`}>Срочно</span>}
                      <span className={styles.badge}>{report.archived ? "Архив" : "Опубликовано"}</span>
                    </div>
                    <div className={styles.actions}>
                      {!apiPayload.apiReportIds.has(report.id) ? (
                        <button
                          className={styles.secondaryButton}
                          onClick={() => toggleOrganizationReportArchive(report.id)}
                        >
                          {report.archived ? "Вернуть из архива" : "В архив"}
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
