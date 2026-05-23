"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Animal } from "@/shared/api/endpoints/animals";
import { VOLUNTEER_COMPETENCY_OPTIONS } from "@/shared/lib/volunteerCompetencyCatalog";
import { WardSelect } from "./WardSelect";
import styles from "./createRequestModal.module.css";

export type RequestKind = "collection" | "volunteer";

export type CreateRequestFormState = {
  title: string;
  isUrgent: boolean;
  linkedAnimalId: string;
  targetAmount: string;
  collectionHelpType: string;
  requisites: string;
  problemDescription: string;
  helpType: string;
  location: string;
  deadlineAt: string;
};

export const emptyCreateForm = (helpTypeDefault = "walk"): CreateRequestFormState => ({
  title: "",
  isUrgent: false,
  linkedAnimalId: "",
  targetAmount: "",
  collectionHelpType: "food",
  requisites: "",
  problemDescription: "",
  helpType: helpTypeDefault,
  location: "",
  deadlineAt: "",
});

const COLLECTION_HELP_OPTIONS = [
  { value: "food", label: "Накормить" },
  { value: "medical", label: "Вылечить" },
  { value: "financial", label: "Другое" },
] as const;

type ModalStep = "choose" | "collection" | "volunteer";

type CreateRequestModalProps = {
  animals: Animal[];
  volunteerTaskTypeOptions?: { id: string; label: string }[];
  editingId: number | null;
  initialKind?: RequestKind | null;
  initialStep?: ModalStep;
  form: CreateRequestFormState;
  onFormChange: (patch: Partial<CreateRequestFormState>) => void;
  defaultBankAccountDigits?: string;
  saving: boolean;
  errorText?: string;
  onClose: () => void;
  onSave: (opts: { kind: RequestKind; publish: boolean }) => void;
};

export function CreateRequestModal({
  animals,
  volunteerTaskTypeOptions,
  editingId,
  initialKind = null,
  initialStep,
  form,
  onFormChange,
  defaultBankAccountDigits = "",
  saving,
  errorText,
  onClose,
  onSave,
}: CreateRequestModalProps) {
  const [step, setStep] = useState<ModalStep>(
    initialStep ?? (editingId != null && initialKind ? initialKind : "choose")
  );
  const [pickedKind, setPickedKind] = useState<RequestKind | null>(initialKind);

  useEffect(() => {
    if (step !== "collection" || !defaultBankAccountDigits) return;
    if (!form.requisites.trim()) {
      onFormChange({ requisites: defaultBankAccountDigits });
    }
  }, [step, defaultBankAccountDigits, form.requisites, onFormChange]);

  const volunteerHelpTypes =
    volunteerTaskTypeOptions?.length ? volunteerTaskTypeOptions : VOLUNTEER_COMPETENCY_OPTIONS;

  const activeKind: RequestKind | null =
    step === "collection" ? "collection" : step === "volunteer" ? "volunteer" : pickedKind;

  const goNext = () => {
    if (!pickedKind) return;
    setStep(pickedKind);
  };

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    if (!activeKind) return;
    onSave({ kind: activeKind, publish: true });
  };

  const handleDraft = () => {
    if (!activeKind) return;
    onSave({ kind: activeKind, publish: false });
  };

  const title = editingId != null ? "Редактировать заявку" : "Создать заявку";

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.shell}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-request-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="create-request-title" className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeBtn} aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.body}>
          {step === "choose" ? (
            <div className={styles.chooseBody}>
              <button
                type="button"
                className={`${styles.kindBtn} ${styles.kindBtnCollection} ${
                  pickedKind === "collection" ? styles.kindBtnSelected : ""
                }`}
                onClick={() => setPickedKind("collection")}
              >
                Открыть сбор
              </button>
              <button
                type="button"
                className={`${styles.kindBtn} ${styles.kindBtnVolunteer} ${
                  pickedKind === "volunteer" ? styles.kindBtnSelected : ""
                }`}
                onClick={() => setPickedKind("volunteer")}
              >
                Нужен волонтёр
              </button>
            </div>
          ) : step === "collection" ? (
            <form id="create-request-form" className={styles.formStack} onSubmit={handlePublish}>
              <label className={styles.fieldLabel}>
                Название / Заголовок
                <input
                  className={styles.fieldInput}
                  placeholder="Краткая суть"
                  value={form.title}
                  onChange={(e) => onFormChange({ title: e.target.value })}
                  required
                />
              </label>

              <div className={styles.urgentRow}>
                <span>Срочно</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.isUrgent}
                    onChange={(e) => onFormChange({ isUrgent: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <label className={styles.fieldLabel}>
                Подопечный
                <WardSelect
                  animals={animals}
                  value={form.linkedAnimalId}
                  onChange={(linkedAnimalId) => onFormChange({ linkedAnimalId })}
                  placeholder="Выберите подопечного"
                />
              </label>

              <label className={styles.fieldLabel}>
                Сумма (₽)
                <input
                  className={styles.fieldInput}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Введите необходимую сумму"
                  value={form.targetAmount}
                  onChange={(e) => onFormChange({ targetAmount: e.target.value })}
                />
              </label>

              <label className={styles.fieldLabel}>
                Тип помощи
                <select
                  className={styles.fieldSelect}
                  value={form.collectionHelpType}
                  onChange={(e) => onFormChange({ collectionHelpType: e.target.value })}
                >
                  {COLLECTION_HELP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                Реквизиты
                <input
                  className={styles.fieldInput}
                  placeholder="Расчётный счёт из профиля организации"
                  inputMode="numeric"
                  value={form.requisites}
                  onChange={(e) => onFormChange({ requisites: e.target.value })}
                />
              </label>

              <label className={styles.fieldLabel}>
                Описание
                <div className={styles.editorWrap}>
                  <textarea
                    className={`${styles.fieldTextarea} ${styles.fieldTextareaWithToolbar}`}
                    placeholder="Расскажите, что случилось"
                    value={form.problemDescription}
                    onChange={(e) => onFormChange({ problemDescription: e.target.value })}
                    required
                    minLength={10}
                  />
                </div>
              </label>

              {errorText ? <p className={styles.formError}>{errorText}</p> : null}
            </form>
          ) : (
            <form id="create-request-form" className={styles.formStack} onSubmit={handlePublish}>
              <label className={styles.fieldLabel}>
                Название / Заголовок
                <input
                  className={styles.fieldInput}
                  placeholder="Краткая суть"
                  value={form.title}
                  onChange={(e) => onFormChange({ title: e.target.value })}
                  required
                />
              </label>

              <div className={styles.urgentRow}>
                <span>Срочно</span>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={form.isUrgent}
                    onChange={(e) => onFormChange({ isUrgent: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <label className={styles.fieldLabel}>
                Подопечный
                <WardSelect
                  animals={animals}
                  value={form.linkedAnimalId}
                  onChange={(linkedAnimalId) => onFormChange({ linkedAnimalId })}
                />
              </label>

              <label className={styles.fieldLabel}>
                Тип помощи
                <select
                  className={styles.fieldSelect}
                  value={form.helpType}
                  onChange={(e) => onFormChange({ helpType: e.target.value })}
                >
                  {volunteerHelpTypes.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.fieldLabel}>
                Локация
                <input
                  className={styles.fieldInput}
                  placeholder="Начните вводить адрес"
                  value={form.location}
                  onChange={(e) => onFormChange({ location: e.target.value })}
                />
              </label>

              <label className={styles.fieldLabel}>
                Дата и время
                <div className={styles.datetimeWrap}>
                  <input
                    className={styles.fieldInput}
                    type="datetime-local"
                    value={form.deadlineAt}
                    onChange={(e) => onFormChange({ deadlineAt: e.target.value })}
                  />
                  <img src="/clock.svg" alt="" className={styles.datetimeIcon} aria-hidden />
                </div>
              </label>

              <label className={styles.fieldLabel}>
                Инструкции
                <div className={styles.editorWrap}>
                  <textarea
                    className={`${styles.fieldTextarea} ${styles.fieldTextareaWithToolbar}`}
                    placeholder="Расскажите, что нужно сделать"
                    value={form.problemDescription}
                    onChange={(e) => onFormChange({ problemDescription: e.target.value })}
                    required
                    minLength={10}
                  />
                </div>
              </label>

              {errorText ? <p className={styles.formError}>{errorText}</p> : null}
            </form>
          )}
        </div>

        <footer
          className={`${styles.footer} ${step !== "choose" ? styles.footerWithDraft : ""}`}
        >
          {step === "choose" ? (
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!pickedKind}
              onClick={goNext}
            >
              Далее
            </button>
          ) : (
            <>
              <button
                type="button"
                className={styles.draftLink}
                disabled={saving}
                onClick={handleDraft}
              >
                Сохранить в черновики
              </button>
              <button
                type="submit"
                form="create-request-form"
                className={styles.primaryBtn}
                disabled={saving}
              >
                {saving ? "Сохранение…" : "Опубликовать заявку"}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function EditorToolbar() {
  const icons = ["Aa", "≡", "B", "I", "U", "S", "•", "1.", "🔗", "❝", "—"];
  return (
    <div className={styles.editorToolbar} aria-hidden>
      {icons.map((icon) => (
        <span key={icon} className={styles.toolbarBtn}>
          {icon}
        </span>
      ))}
    </div>
  );
}
