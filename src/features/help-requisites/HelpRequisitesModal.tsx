"use client";

import { useEffect, useState } from "react";
import { ModalPortal } from "@/shared/ui/ModalPortal";
import styles from "./helpRequisitesModal.module.css";
import { formatHelpRub } from "@/features/help-animal-card/helpAnimalCardModel";
import { animalsApi, type Animal } from "@/shared/api/endpoints/animals";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import { urgentApi } from "@/shared/api/endpoints/urgent";

export interface HelpRequisitesModalProps {
  animalId?: number | null;
  organizationId?: number | null;
  animalName: string;
  organizationName: string;
  needText: string;
  primaryHelpRequestId: number | null;
  targetAmount?: string | null;
  onClose: () => void;
}

export function HelpRequisitesModal({
  animalId,
  organizationId,
  animalName,
  organizationName,
  needText,
  primaryHelpRequestId,
  targetAmount,
  onClose,
}: HelpRequisitesModalProps) {
  const [loading, setLoading] = useState(true);
  const [targetAmountText, setTargetAmountText] = useState<string | null>(targetAmount?.trim() || null);
  const [requisitesText, setRequisitesText] = useState("");
  const [problemText, setProblemText] = useState(needText);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        let problem = needText;
        let amountText = targetAmount?.trim() || null;
        if (primaryHelpRequestId != null) {
          const u = await urgentApi.getById(primaryHelpRequestId).catch(() => null);
          if (u?.description?.trim()) problem = u.description.trim();
          if (u?.target_amount != null && u.target_amount > 0) {
            amountText = formatHelpRub(u.target_amount);
          }
        }

        let orgId: number | undefined;
        if (animalId != null && animalId > 0) {
          const animal = (await animalsApi.getById(animalId)) as Animal;
          orgId = animal.organization?.id;
        } else if (organizationId != null && organizationId > 0) {
          orgId = organizationId;
        }
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
          setTargetAmountText(amountText);
          setRequisitesText(req);
          setProblemText(problem);
        }
      } catch {
        if (!cancelled) {
          setTargetAmountText(targetAmount?.trim() || null);
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
  }, [animalId, organizationId, primaryHelpRequestId, needText, organizationName, targetAmount]);

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
              {targetAmountText ? (
                <p className={styles.amountLine}>
                  <span className={styles.amountLabel}>Необходимая сумма:</span> {targetAmountText}
                </p>
              ) : null}
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
