"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import {
  getOrganizationCabinetEventName,
  type OrganizationReport,
} from "@/shared/lib/organizationCabinet";
import { mapMeReportRow, unwrapApiList } from "@/shared/lib/organizationMeCabinet";
import { useUser } from "@/shared/lib/hooks/useUser";

type VisibilityFilter = "all" | "archive";

type ReportForm = {
  title: string;
  content: string;
};

const emptyForm: ReportForm = {
  title: "",
  content: "",
};

function notifyCabinetUpdated() {
  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
}

export default function OrganizationReportsPage() {
  const { role } = useUser();
  const [reports, setReports] = useState<OrganizationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [errorText, setErrorText] = useState("");
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ReportForm>(emptyForm);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ReportForm>(emptyForm);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      if (role !== "organization") {
        setReports([]);
        return;
      }
      const raw = await meOrganizationApi.listReports();
      const rows = unwrapApiList<Record<string, unknown>>(raw);
      setReports(rows.map(mapMeReportRow).filter((r) => r.id > 0));
    } catch (e) {
      setReports([]);
      setErrorText(e instanceof Error ? e.message : "Не удалось загрузить отчёты.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports
      .filter((item) => (visibilityFilter === "archive" ? item.archived : !item.archived))
      .filter((item) => {
        if (!query) return true;
        return `${item.title} ${item.content}`.toLowerCase().includes(query);
      });
  }, [reports, search, visibilityFilter]);

  const openCreateModal = () => {
    setCreateForm(emptyForm);
    setCreateModalOpen(true);
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim() || !createForm.content.trim()) return;
    void meOrganizationApi
      .createReport({
        title: createForm.title.trim(),
        body: createForm.content.trim(),
        summary: createForm.content.trim().slice(0, 600),
        is_published: true,
      })
      .then(() => {
        setCreateModalOpen(false);
        setCreateForm(emptyForm);
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) =>
        setErrorText(e instanceof Error ? e.message : "Не удалось опубликовать отчёт.")
      );
  };

  const openEditModal = (report: OrganizationReport) => {
    setEditId(report.id);
    setEditForm({
      title: report.title,
      content: report.content,
    });
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editId === null || !editForm.title.trim() || !editForm.content.trim()) return;
    void meOrganizationApi
      .patchReport(editId, {
        title: editForm.title.trim(),
        body: editForm.content.trim(),
        summary: editForm.content.trim().slice(0, 600),
      })
      .then(() => {
        setEditId(null);
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось сохранить отчёт."));
  };

  const handleArchive = (report: OrganizationReport) => {
    setBusyId(report.id);
    void meOrganizationApi
      .patchReport(report.id, { is_published: false })
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) =>
        setErrorText(e instanceof Error ? e.message : "Не удалось отправить отчёт в архив.")
      )
      .finally(() => setBusyId(null));
  };

  const handleDelete = (report: OrganizationReport) => {
    const ok = window.confirm("Удалить отчёт безвозвратно?");
    if (!ok) return;
    setBusyId(report.id);
    void meOrganizationApi
      .deleteReport(report.id)
      .then(() => {
        notifyCabinetUpdated();
        return reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось удалить отчёт."))
      .finally(() => setBusyId(null));
  };

  const renderForm = (
    form: ReportForm,
    setForm: (next: ReportForm) => void,
    onSubmit: (e: FormEvent<HTMLFormElement>) => void,
    submitLabel: string,
    onCancel: () => void
  ) => (
    <form className={styles.form} onSubmit={onSubmit}>
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
        Текст отчёта
        <textarea
          className={styles.textarea}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          required
        />
      </label>
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
              <h1 className={styles.title}>Отчёты</h1>
              <p className={styles.subtitle}>
                Публикуйте отчёты о сборах, расходах и результатах помощи.
              </p>
            </div>
            <button type="button" className={styles.addBtn} onClick={openCreateModal}>
              + Добавить отчёт
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
              aria-label="Фильтр отчётов"
            >
              <option value="all">Все</option>
              <option value="archive">Архив</option>
            </select>
          </div>
        </div>

        {errorText ? <p className={styles.error}>{errorText}</p> : null}
        {loading ? <p className={styles.empty}>Загрузка…</p> : null}

        {!loading && visibleReports.length === 0 ? (
          <p className={styles.empty}>
            {visibilityFilter === "archive" ? "В архиве пока нет отчётов." : "Отчёты пока не добавлены."}
          </p>
        ) : null}

        {!loading && visibleReports.length > 0 ? (
          <section className={styles.list}>
            {visibleReports.map((report) => (
              <article key={report.id} className={styles.itemCard}>
                <h2 className={styles.itemTitle}>{report.title}</h2>
                <p className={styles.summaryLine}>{report.content}</p>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${report.archived ? styles.badgeArchived : ""}`.trim()}>
                    {report.archived ? "Архив" : "Опубликовано"}
                  </span>
                </div>
                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.editBtn}
                    disabled={busyId === report.id}
                    onClick={() => openEditModal(report)}
                  >
                    Изменить
                  </button>
                  {!report.archived ? (
                    <button
                      type="button"
                      className={styles.archiveBtn}
                      disabled={busyId === report.id}
                      onClick={() => handleArchive(report)}
                    >
                      В архив
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    disabled={busyId === report.id}
                    onClick={() => handleDelete(report)}
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
            <h2 className={styles.modalTitle}>Добавить отчёт</h2>
            {renderForm(createForm, setCreateForm, handleCreate, "Опубликовать", () => setCreateModalOpen(false))}
          </div>
        </div>
      ) : null}

      {editId !== null ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setEditId(null)}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Редактировать отчёт</h2>
            {renderForm(editForm, setEditForm, handleEdit, "Сохранить", () => setEditId(null))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
