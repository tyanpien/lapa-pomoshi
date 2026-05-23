"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatAdoptionApplicationFieldsHuman } from "@/features/adoption-questionnaire/formatMessage";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import styles from "./page.module.css";

type IncomingTab = "adoptions" | "volunteers";

type IncomingAdoptionItem = {
  id: number;
  applicant_user_id: number;
  applicant_name?: string | null;
  applicant_email?: string | null;
  applicant_phone?: string | null;
  animal_id: number;
  animal_name: string;
  created_at: string;
  status: string;
  status_label: string;
  message: string | null;
};

type IncomingVolunteerResponseItem = {
  id: number;
  volunteer_user_id: number;
  volunteer_name: string;
  help_request_id: number;
  help_request_title: string;
  created_at: string;
  status: string;
  status_label: string;
  message: string | null;
  report_body?: string | null;
  report_submitted_at?: string | null;
  report_awaiting_org_review?: boolean;
  report_rejection_reason?: string | null;
  can_complete?: boolean;
  can_reject_report?: boolean;
};

function statusClass(status: string): string {
  if (status === "approved" || status === "accepted" || status === "completed") {
    return styles.statusApproved;
  }
  if (status === "rejected") return styles.statusRejected;
  if (status === "pending_review" || status === "pending") return styles.statusPending;
  return "";
}

function incomingStatusRank(status: string): number {
  if (status === "pending_review" || status === "pending") return 0;
  if (status === "accepted") return 1;
  if (status === "rejected" || status === "withdrawn") return 2;
  if (status === "completed") return 3;
  return 1;
}

function sortIncomingByStatus<T extends { status: string; created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const byStatus = incomingStatusRank(a.status) - incomingStatusRank(b.status);
    if (byStatus !== 0) return byStatus;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function IncomingTabs({
  tab,
  onTabChange,
}: {
  tab: IncomingTab;
  onTabChange: (t: IncomingTab) => void;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Тип входящих заявок">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "adoptions"}
        className={tab === "adoptions" ? styles.tabActive : styles.tab}
        onClick={() => onTabChange("adoptions")}
      >
        Анкеты пристройства
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "volunteers"}
        className={tab === "volunteers" ? styles.tabActive : styles.tab}
        onClick={() => onTabChange("volunteers")}
      >
        Отклики волонтёров
      </button>
    </div>
  );
}

function IncomingActionButtons({
  busyId,
  itemId,
  onApprove,
  onReject,
  approveLabel,
}: {
  busyId: number | null;
  itemId: number;
  onApprove: () => void;
  onReject: () => void;
  approveLabel: string;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.approveBtn}
        disabled={busyId === itemId}
        onClick={onApprove}
      >
        {approveLabel}
      </button>
      <button
        type="button"
        className={styles.rejectBtn}
        disabled={busyId === itemId}
        onClick={onReject}
      >
        Отклонить
      </button>
    </>
  );
}

function VolunteerCardTop({ item }: { item: IncomingVolunteerResponseItem }) {
  return (
    <div className={styles.cardTop}>
      <div>
        <h2 className={styles.cardTitle}>{item.help_request_title}</h2>
        <p className={styles.meta}>
          {item.volunteer_name} · заявка #{item.help_request_id}
        </p>
        <p className={styles.meta}>{new Date(item.created_at).toLocaleString("ru-RU")}</p>
      </div>
      <span className={`${styles.status} ${statusClass(item.status)}`.trim()}>{item.status_label}</span>
    </div>
  );
}

export default function OrganizationIncomingPage() {
  const [tab, setTab] = useState<IncomingTab>("adoptions");
  const [adoptions, setAdoptions] = useState<IncomingAdoptionItem[]>([]);
  const [volunteerResponses, setVolunteerResponses] = useState<IncomingVolunteerResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const reloadAdoptions = useCallback(() => {
    return meOrganizationApi
      .listIncomingAdoptions()
      .then((res) => {
        const data = res as { items?: IncomingAdoptionItem[] };
        setAdoptions(data.items ?? []);
      })
      .catch(() => setErrorText("Не удалось загрузить входящие анкеты."));
  }, []);

  const reloadVolunteers = useCallback(() => {
    return meOrganizationApi
      .listIncomingVolunteerResponses()
      .then((res) => {
        const data = res as { items?: IncomingVolunteerResponseItem[] };
        setVolunteerResponses(data.items ?? []);
      })
      .catch(() => setErrorText("Не удалось загрузить отклики волонтёров."));
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setErrorText("");
    const task = tab === "adoptions" ? reloadAdoptions() : reloadVolunteers();
    void task.finally(() => setLoading(false));
  }, [tab, reloadAdoptions, reloadVolunteers]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleApproveAdoption = (id: number) => {
    setBusyId(id);
    void meOrganizationApi
      .approveIncomingAdoption(id)
      .then(() => reloadAdoptions())
      .catch(() => setErrorText("Не удалось одобрить анкету."))
      .finally(() => setBusyId(null));
  };

  const handleRejectAdoption = (id: number) => {
    const reason = window.prompt("Причина отклонения (необязательно):") ?? "";
    setBusyId(id);
    void meOrganizationApi
      .rejectIncomingAdoption(id, reason.trim() ? { reason: reason.trim() } : {})
      .then(() => reloadAdoptions())
      .catch(() => setErrorText("Не удалось отклонить анкету."))
      .finally(() => setBusyId(null));
  };

  const handleAcceptVolunteer = (id: number) => {
    setBusyId(id);
    void meOrganizationApi
      .acceptVolunteerResponse(id)
      .then(() => reloadVolunteers())
      .catch(() => setErrorText("Не удалось принять отклик."))
      .finally(() => setBusyId(null));
  };

  const handleRejectVolunteer = (id: number) => {
    const reason = window.prompt("Причина отклонения (необязательно):") ?? "";
    setBusyId(id);
    void meOrganizationApi
      .rejectVolunteerResponse(id, reason.trim() ? { reason: reason.trim() } : {})
      .then(() => reloadVolunteers())
      .catch(() => setErrorText("Не удалось отклонить отклик."))
      .finally(() => setBusyId(null));
  };

  const handleCompleteVolunteer = (id: number) => {
    setBusyId(id);
    void meOrganizationApi
      .completeVolunteerResponse(id)
      .then(() => reloadVolunteers())
      .catch(() => setErrorText("Не удалось завершить задачу."))
      .finally(() => setBusyId(null));
  };

  const handleRejectVolunteerReport = (id: number) => {
    const reason = window.prompt("Что исправить в отчёте?") ?? "";
    if (!reason.trim()) return;
    setBusyId(id);
    void meOrganizationApi
      .rejectVolunteerReport(id, { reason: reason.trim() })
      .then(() => reloadVolunteers())
      .catch(() => setErrorText("Не удалось отклонить отчёт."))
      .finally(() => setBusyId(null));
  };

  const adoptionApplicantName = (item: IncomingAdoptionItem) =>
    item.applicant_name?.trim() || "Заявитель";

  const sortedAdoptions = useMemo(() => sortIncomingByStatus(adoptions), [adoptions]);
  const sortedVolunteerResponses = useMemo(
    () => sortIncomingByStatus(volunteerResponses),
    [volunteerResponses]
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Входящие заявки</h1>
        <p>Анкеты на пристройство и отклики волонтёров на ваши заявки о помощи</p>
      </header>

      <IncomingTabs tab={tab} onTabChange={setTab} />

      {errorText ? <p className={styles.error}>{errorText}</p> : null}
      {loading ? <p className={styles.empty}>Загрузка…</p> : null}

      {tab === "adoptions" ? (
        <>
          {!loading && adoptions.length === 0 && !errorText ? (
            <p className={styles.empty}>Пока нет входящих анкет.</p>
          ) : null}
          <section className={styles.list}>
            {!loading &&
              sortedAdoptions.map((item) => (
                <article key={item.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <h2 className={styles.cardTitle}>{item.animal_name}</h2>
                      <p className={styles.meta}>
                        {adoptionApplicantName(item)}
                        {item.applicant_phone ? ` · ${item.applicant_phone}` : ""}
                        {item.applicant_email ? ` · ${item.applicant_email}` : ""}
                      </p>
                      <p className={styles.meta}>
                        {new Date(item.created_at).toLocaleString("ru-RU")}
                      </p>
                    </div>
                    <span className={`${styles.status} ${statusClass(item.status)}`.trim()}>
                      {item.status_label}
                    </span>
                  </div>

                  <pre className={styles.message}>{formatAdoptionApplicationFieldsHuman(item)}</pre>

                  <div className={styles.actions}>
                    <Link
                      href={`/messages?applicationId=${item.id}`}
                      className={styles.contactBtn}
                    >
                      Связаться с заявителем
                    </Link>
                    {item.status === "pending_review" ? (
                      <IncomingActionButtons
                        busyId={busyId}
                        itemId={item.id}
                        onApprove={() => handleApproveAdoption(item.id)}
                        onReject={() => handleRejectAdoption(item.id)}
                        approveLabel="Одобрить"
                      />
                    ) : null}
                  </div>
                </article>
              ))}
          </section>
        </>
      ) : (
        <>
          {!loading && volunteerResponses.length === 0 && !errorText ? (
            <p className={styles.empty}>Пока нет откликов волонтёров.</p>
          ) : null}
          <section className={styles.list}>
            {!loading &&
              sortedVolunteerResponses.map((item) => (
                <article key={item.id} className={styles.card}>
                  <VolunteerCardTop item={item} />
                  {item.message?.trim() ? (
                    <pre className={styles.message}>{item.message.trim()}</pre>
                  ) : (
                    <p className={styles.message}>Сообщение не указано.</p>
                  )}
                  {item.report_body?.trim() ? (
                    <div className={styles.reportBlock}>
                      <p className={styles.reportLabel}>Отчёт волонтёра</p>
                      <pre className={styles.message}>{item.report_body.trim()}</pre>
                      {item.report_awaiting_org_review ? (
                        <p className={styles.reportMeta}>Ожидает проверки организации</p>
                      ) : null}
                      {item.report_rejection_reason?.trim() ? (
                        <p className={styles.reportRejected}>
                          Отчёт возвращён на доработку: {item.report_rejection_reason.trim()}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className={styles.actions}>
                    <Link
                      href={`/messages?volunteerResponseId=${item.id}`}
                      className={styles.contactBtn}
                    >
                      Связаться с волонтёром
                    </Link>
                    {item.status === "pending" ? (
                      <IncomingActionButtons
                        busyId={busyId}
                        itemId={item.id}
                        onApprove={() => handleAcceptVolunteer(item.id)}
                        onReject={() => handleRejectVolunteer(item.id)}
                        approveLabel="Принять в работу"
                      />
                    ) : item.can_complete ? (
                      <>
                        <button
                          type="button"
                          className={styles.approveBtn}
                          disabled={busyId === item.id}
                          onClick={() => handleCompleteVolunteer(item.id)}
                        >
                          {item.report_awaiting_org_review ? "Принять отчёт и завершить" : "Завершить задачу"}
                        </button>
                        {item.can_reject_report ? (
                          <button
                            type="button"
                            className={styles.rejectBtn}
                            disabled={busyId === item.id}
                            onClick={() => handleRejectVolunteerReport(item.id)}
                          >
                            Вернуть отчёт
                          </button>
                        ) : null}
                      </>
                    ) : item.status === "completed" ? (
                      <Link href="/organization/requests" className={styles.contactBtn}>
                        Задача завершена
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
          </section>
        </>
      )}
    </main>
  );
}
