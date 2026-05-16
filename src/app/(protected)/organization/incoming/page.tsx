"use client";

import { useCallback, useEffect, useState } from "react";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import {
  formatAdoptionQuestionnaireHuman,
  parseAdoptionQuestionnaireMessage,
} from "@/features/adoption-questionnaire/formatMessage";
import styles from "./page.module.css";

type IncomingAdoptionItem = {
  id: number;
  applicant_user_id: number;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  animal_id: number;
  animal_name: string;
  created_at: string;
  status: string;
  status_label: string;
  message: string | null;
};

function formatMessageForDisplay(message: string | null): string {
  if (!message?.trim()) return "—";
  const parsed = parseAdoptionQuestionnaireMessage(message);
  if (parsed) return formatAdoptionQuestionnaireHuman(parsed);
  const humanPart = message.split("\n\n__ADOPTION_FORM_")[0]?.trim();
  return humanPart || message;
}

function statusClass(status: string): string {
  if (status === "approved") return styles.statusApproved;
  if (status === "rejected") return styles.statusRejected;
  if (status === "pending_review") return styles.statusPending;
  return "";
}

export default function OrganizationIncomingPage() {
  const [items, setItems] = useState<IncomingAdoptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setErrorText("");
    void meOrganizationApi
      .listIncomingAdoptions()
      .then((res) => {
        const data = res as { items?: IncomingAdoptionItem[] };
        setItems(data.items ?? []);
      })
      .catch(() => setErrorText("Не удалось загрузить входящие анкеты."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleApprove = (id: number) => {
    setBusyId(id);
    void meOrganizationApi
      .approveIncomingAdoption(id)
      .then(() => reload())
      .catch(() => setErrorText("Не удалось одобрить анкету."))
      .finally(() => setBusyId(null));
  };

  const handleReject = (id: number) => {
    setBusyId(id);
    void meOrganizationApi
      .rejectIncomingAdoption(id)
      .then(() => reload())
      .catch(() => setErrorText("Не удалось отклонить анкету."))
      .finally(() => setBusyId(null));
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Входящие заявки</h1>
        <p>Анкеты будущих владельцев на ваших подопечных</p>
      </header>

      {errorText ? <p className={styles.error}>{errorText}</p> : null}
      {loading ? <p className={styles.empty}>Загрузка…</p> : null}

      {!loading && items.length === 0 && !errorText ? (
        <p className={styles.empty}>Пока нет входящих анкет.</p>
      ) : null}

      <section className={styles.list}>
        {!loading &&
          items.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardTitle}>{item.animal_name}</h2>
                  <p className={styles.meta}>
                    {item.applicant_name}
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

              <pre className={styles.message}>{formatMessageForDisplay(item.message)}</pre>

              {item.status === "pending_review" ? (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.approveBtn}
                    disabled={busyId === item.id}
                    onClick={() => handleApprove(item.id)}
                  >
                    Одобрить
                  </button>
                  <button
                    type="button"
                    className={styles.rejectBtn}
                    disabled={busyId === item.id}
                    onClick={() => handleReject(item.id)}
                  >
                    Отклонить
                  </button>
                </div>
              ) : null}
            </article>
          ))}
      </section>
    </main>
  );
}
