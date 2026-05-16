"use client";

import { useEffect, useState } from "react";
import { ModalPortal } from "@/shared/ui/ModalPortal";
import styles from "./helpRequisitesModal.module.css";
import { animalsApi, type Animal } from "@/shared/api/endpoints/animals";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import { urgentApi } from "@/shared/api/endpoints/urgent";

export interface HelpRequisitesModalProps {
  animalId: number;
  animalName: string;
  organizationName: string;
  needText: string;
  primaryHelpRequestId: number | null;
  onClose: () => void;
}

export function HelpRequisitesModal({
  animalId,
  animalName,
  organizationName,
  needText,
  primaryHelpRequestId,
  onClose,
}: HelpRequisitesModalProps) {
  const [loading, setLoading] = useState(true);
  const [requisitesText, setRequisitesText] = useState("");
  const [problemText, setProblemText] = useState(needText);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let problem = needText;
        if (primaryHelpRequestId != null) {
          const u = await urgentApi.getById(primaryHelpRequestId).catch(() => null);
          if (u?.description?.trim()) problem = u.description.trim();
        }

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
        if (!cancelled) {
          setRequisitesText(req);
          setProblemText(problem);
        }
      } catch {
        if (!cancelled) {
          setRequisitesText("Не удалось загрузить реквизиты.");
          setProblemText(needText);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [animalId, primaryHelpRequestId, needText, organizationName]);

  return (
    <ModalPortal>
      <div className={styles.overlay} role="presentation" onClick={onClose}>
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-requisites-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="help-requisites-modal-title" className={styles.title}>
            Помочь: {animalName}
          </h2>
          {loading ? <p className={styles.status}>Загрузка…</p> : null}
          {!loading ? (
            <>
              <div className={styles.block}>
                <h3 className={styles.blockTitle}>Реквизиты</h3>
                <pre className={styles.pre}>{requisitesText}</pre>
              </div>
              <div className={styles.block}>
                <h3 className={styles.blockTitle}>Описание проблемы от организации</h3>
                <p className={styles.problem}>{problemText}</p>
              </div>
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
