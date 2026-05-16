"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModalPortal } from "@/shared/ui/ModalPortal";
import styles from "./animalHelpModal.module.css";
import { animalsApi, type Animal } from "@/shared/api/endpoints/animals";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import type { HelpAnimalMonetary } from "@/shared/api/endpoints/help";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { getUrgentHelpTypeLabel } from "@/shared/lib/urgentHelpTypeLabels";

export interface AnimalHelpModalProps {
  animalId: number;
  animalName: string;
  organizationName: string;
  monetaryNeeds: HelpAnimalMonetary[];
  linkedHelpRows: UrgentItem[];
  needsLoading: boolean;
  onClose: () => void;
}

const formatMonetaryNeedText = (m: HelpAnimalMonetary) => {
  const amount =
    m.amount_rub != null && m.amount_rub > 0
      ? ` — ${new Intl.NumberFormat("ru-RU").format(m.amount_rub)} ₽`
      : "";
  return `${m.line}${amount}`;
};

export function AnimalHelpModal({
  animalId,
  animalName,
  organizationName,
  monetaryNeeds,
  linkedHelpRows,
  needsLoading,
  onClose,
}: AnimalHelpModalProps) {
  const [requisitesLoading, setRequisitesLoading] = useState(true);
  const [requisitesText, setRequisitesText] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRequisitesLoading(true);
    void (async () => {
      try {
        const animal = (await animalsApi.getById(animalId)) as Animal;
        const orgId = animal.organization?.id;
        let req = "";
        if (orgId) {
          const org = await organizationsApi.getById(orgId);
          const a = org.about;
          const parts = [
            a.inn ? `ИНН: ${a.inn}` : "",
            a.ogrn ? `ОГРН: ${a.ogrn}` : "",
            a.bank_account ? `Расчётный счёт: ${a.bank_account}` : "",
          ].filter(Boolean);
          req = parts.length > 0 ? parts.join("\n") : "Реквизиты не заполнены в профиле организации.";
        } else {
          req = `Реквизиты можно уточнить у организации «${organizationName}».`;
        }
        if (!cancelled) setRequisitesText(req);
      } catch {
        if (!cancelled) setRequisitesText("Не удалось загрузить реквизиты.");
      } finally {
        if (!cancelled) setRequisitesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [animalId, organizationName]);

  const loading = needsLoading || requisitesLoading;
  const hasNeeds = monetaryNeeds.length > 0 || linkedHelpRows.length > 0;

  return (
    <ModalPortal>
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="animal-help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="animal-help-modal-title" className={styles.title}>
          Помочь: {animalName}
        </h2>

        {loading ? <p className={styles.status}>Загрузка…</p> : null}

        {!loading ? (
          <>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Актуальные заявки и потребности</h3>
              {!hasNeeds ? <p className={styles.empty}>Нет открытых заявок.</p> : null}

              {monetaryNeeds.length > 0 ? (
                <div className={styles.subsection}>
                  <h4 className={styles.subsectionTitle}>Сборы и материальная помощь</h4>
                  <ul className={styles.needsList}>
                    {monetaryNeeds.map((m) => (
                      <li key={m.request_id} className={styles.needItem}>
                        {formatMonetaryNeedText(m)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {linkedHelpRows.length > 0 ? (
                <div className={styles.subsection}>
                  <h4 className={styles.subsectionTitle}>Заявки</h4>
                  {linkedHelpRows.map((row) => (
                    <article key={row.id} className={styles.requestCard}>
                      <p className={styles.requestTitle}>{row.title}</p>
                      <p className={styles.requestMeta}>
                        {getUrgentHelpTypeLabel(row.help_type)}
                        {row.is_urgent ? " · срочно" : ""}
                        {row.volunteer_needed ? " · нужен волонтёр" : ""}
                      </p>
                      {row.description ? (
                        <p className={styles.requestDesc}>{row.description}</p>
                      ) : null}
                      <Link href={`/urgent/${row.id}`} className={styles.requestLink}>
                        Открыть заявку
                      </Link>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Реквизиты</h3>
              <pre className={styles.pre}>{requisitesText}</pre>
            </section>
          </>
        ) : null}

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
    </ModalPortal>
  );
}
