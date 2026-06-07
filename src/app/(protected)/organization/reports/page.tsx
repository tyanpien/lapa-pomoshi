"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const REPORT_FILE_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,image/*,application/pdf";

function notifyCabinetUpdated() {
  window.dispatchEvent(new Event(getOrganizationCabinetEventName()));
}

function pickReportId(created: unknown): number | null {
  if (!created || typeof created !== "object") return null;
  const id = (created as { id?: unknown }).id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}

function buildReportBody(form: ReportForm) {
  const comment = form.content.trim();
  return {
    title: form.title.trim(),
    body: comment || null,
    summary: comment ? comment.slice(0, 600) : null,
  };
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
  const [editExistingFileUrl, setEditExistingFileUrl] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingFileRef = useRef<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");

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

  const resetFileState = () => {
    pendingFileRef.current = null;
    setSelectedFileName("");
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    setSelectedFileName(file.name);
  };

  const openCreateModal = () => {
    setCreateForm(emptyForm);
    resetFileState();
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    resetFileState();
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = pendingFileRef.current;
    if (!createForm.title.trim() || !file) return;

    setSubmitting(true);
    setErrorText("");
    void meOrganizationApi
      .createReport({
        ...buildReportBody(createForm),
        is_published: true,
      })
      .then(async (created) => {
        const reportId = pickReportId(created);
        if (reportId == null) throw new Error("Не удалось получить id отчёта.");
        await meOrganizationApi.uploadReportFile(reportId, file);
        closeCreateModal();
        notifyCabinetUpdated();
        await reload();
      })
      .catch((e) =>
        setErrorText(e instanceof Error ? e.message : "Не удалось опубликовать отчёт.")
      )
      .finally(() => setSubmitting(false));
  };

  const openEditModal = (report: OrganizationReport) => {
    setEditId(report.id);
    setEditForm({
      title: report.title,
      content: report.content,
    });
    setEditExistingFileUrl(report.fileUrl);
    resetFileState();
  };

  const closeEditModal = () => {
    setEditId(null);
    resetFileState();
    setEditExistingFileUrl(undefined);
  };

  const handleEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = pendingFileRef.current;
    if (editId === null || !editForm.title.trim()) return;
    if (!file && !editExistingFileUrl) return;

    setSubmitting(true);
    setErrorText("");
    void meOrganizationApi
      .patchReport(editId, buildReportBody(editForm))
      .then(async () => {
        if (file) await meOrganizationApi.uploadReportFile(editId, file);
        closeEditModal();
        notifyCabinetUpdated();
        await reload();
      })
      .catch((e) => setErrorText(e instanceof Error ? e.message : "Не удалось сохранить отчёт."))
      .finally(() => setSubmitting(false));
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
    onCancel: () => void,
    options: { requireFile: boolean; existingFileUrl?: string }
  ) => {
    const hasSelectedFile = Boolean(selectedFileName);
    const hasFile = hasSelectedFile || Boolean(options.existingFileUrl);
    const canSubmit =
      Boolean(form.title.trim()) && (!options.requireFile || hasSelectedFile) && hasFile;

    return (
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
          Файл отчёта
          <input
            className={styles.fileInput}
            type="file"
            accept={REPORT_FILE_ACCEPT}
            onChange={handleFileSelect}
            required={options.requireFile}
          />
          <span className={styles.fileHint}>
            PDF, Word или изображение, до 15 МБ
            {options.existingFileUrl && !selectedFileName ? (
              <>
                {" · "}
                <a
                  className={styles.fileLink}
                  href={options.existingFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Текущий файл
                </a>
              </>
            ) : null}
            {selectedFileName ? ` · ${selectedFileName}` : null}
          </span>
        </label>
        <label className={styles.label}>
          Комментарий (необязательно)
          <textarea
            className={styles.textarea}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Краткое пояснение к отчёту"
          />
        </label>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={submitting}>
            Отмена
          </button>
          <button type="submit" className={styles.primaryButton} disabled={submitting || !canSubmit}>
            {submitLabel}
          </button>
        </div>
      </form>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageTop}>
          <div className={styles.topRow}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Отчёты</h1>
              <p className={styles.subtitle}>
                Прикрепляйте файлы отчётов о сборах, расходах и результатах помощи. Комментарий — по желанию.
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
                {report.fileUrl ? (
                  <a
                    className={styles.fileLink}
                    href={report.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Скачать файл отчёта
                  </a>
                ) : null}
                {report.content ? <p className={styles.summaryLine}>{report.content}</p> : null}
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
        <div className={styles.modalOverlay} role="presentation" onClick={closeCreateModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Добавить отчёт</h2>
            {renderForm(createForm, setCreateForm, handleCreate, "Опубликовать", closeCreateModal, {
              requireFile: true,
            })}
          </div>
        </div>
      ) : null}

      {editId !== null ? (
        <div className={styles.modalOverlay} role="presentation" onClick={closeEditModal}>
          <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Редактировать отчёт</h2>
            {renderForm(editForm, setEditForm, handleEdit, "Сохранить", closeEditModal, {
              requireFile: false,
              existingFileUrl: editExistingFileUrl,
            })}
          </div>
        </div>
      ) : null}
    </main>
  );
}
