"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { meApplicationsApi } from "@/shared/api/endpoints/meApplications";
import {
  displayPhoneFromStored,
  getRussianPhoneValidationError,
  normalizePhoneDigits,
} from "@/shared/lib/phoneRu";
import { PhoneInput } from "@/shared/ui/PhoneInput";
import { mapAdoptionQuestionnaireToApiBody } from "./formatMessage";
import {
  emptyAdoptionQuestionnaireForm,
  type AdoptionQuestionnaireForm,
  type YesNo,
} from "./types";
import styles from "./adoptionQuestionnaireModal.module.css";

const TOTAL_STEPS = 7;

type AdoptionQuestionnaireModalProps = {
  animalId: number;
  animalName: string;
  applicationId?: number;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  initialForm?: AdoptionQuestionnaireForm;
  onClose: () => void;
  onSaved?: () => void;
};

function Stepper({ step, success }: { step: number; success: boolean }) {
  const nodes = [];
  for (let i = 1; i <= TOTAL_STEPS; i += 1) {
    if (i > 1) {
      const lineDone = success || i - 1 < step;
      nodes.push(
        <div
          key={`line-${i}`}
          className={`${styles.stepperLine} ${lineDone ? styles.stepperLineDone : ""}`.trim()}
          aria-hidden
        />
      );
    }
    const done = success || i < step;
    const active = !success && i === step;
    nodes.push(
      <div
        key={`node-${i}`}
        className={[
          styles.stepperNode,
          done ? styles.stepperNodeDone : "",
          active ? styles.stepperNodeActive : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden
      >
        {done ? "✓" : null}
      </div>
    );
  }
  return <div className={styles.stepper}>{nodes}</div>;
}

function ChoicePair({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className={styles.choiceRow}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.choiceBtn} ${value === opt.value ? styles.choiceBtnActive : ""}`.trim()}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function YesNoPair({ value, onChange }: { value: YesNo | ""; onChange: (v: YesNo) => void }) {
  return (
    <ChoicePair
      value={value}
      onChange={(v) => onChange(v as YesNo)}
      options={[
        { value: "yes", label: "Да" },
        { value: "no", label: "Нет" },
      ]}
    />
  );
}

type Step1FieldErrors = {
  name?: string;
  age?: string;
  phone?: string;
  email?: string;
};

function getStep1FieldErrors(form: AdoptionQuestionnaireForm): Step1FieldErrors {
  const errors: Step1FieldErrors = {};
  if (!form.name.trim()) errors.name = "Укажите имя.";
  if (!form.age.trim() || !/^\d+$/.test(form.age.trim())) {
    errors.age = "Укажите возраст (целое число лет).";
  }
  const phoneError = getRussianPhoneValidationError(form.phone);
  if (phoneError) errors.phone = phoneError;
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Укажите корректный e-mail.";
  }
  return errors;
}

function validateStep(step: number, form: AdoptionQuestionnaireForm): string | null {
  if (step === 1) {
    const errors = getStep1FieldErrors(form);
    return errors.name ?? errors.age ?? errors.phone ?? errors.email ?? null;
  }
  if (step === 2) {
    if (!form.housingType) return "Выберите тип жилья.";
    if (!form.ownership) return "Укажите собственность жилья.";
    if (!form.residentsConsent) return "Ответьте про согласие проживающих.";
    if (!form.hasChildren) return "Ответьте про детей.";
    if (!form.hasAllergy) return "Ответьте про аллергию.";
    return null;
  }
  if (step === 3) {
    if (!form.hadPetsBefore) return "Ответьте, были ли животные раньше.";
    if (!form.hasPetsNow) return "Ответьте, есть ли питомцы сейчас.";
    return null;
  }
  if (step === 4) {
    if (!form.whyNow.trim()) return "Заполните поле «Почему сейчас?».";
    if (!form.lookingFor.trim()) return "Расскажите, кого именно ищете.";
    return null;
  }
  if (step === 5) {
    if (!form.readyForVetExpenses) return "Ответьте про расходы на врача.";
    if (!form.feedingPlan.trim()) return "Укажите, чем планируете кормить.";
    if (!form.readyForVaccination) return "Ответьте про вакцинацию и обработку.";
    return null;
  }
  if (step === 6) {
    if (!form.timeCommitment.trim()) return "Укажите, сколько времени будете уделять.";
    if (!form.vacationCare.trim()) return "Укажите, с кем оставите в отпуске.";
    if (!form.returnPlan.trim()) return "Опишите, что сделаете, если придётся вернуть.";
    return null;
  }
  if (step === 7) {
    if (!form.readyForContract) return "Ответьте про договор.";
    if (!form.readyToShowConditions) return "Ответьте про показ условий жизни.";
    if (!form.readyToKeepInTouch) return "Ответьте про связь после пристройства.";
    return null;
  }
  return null;
}

export function AdoptionQuestionnaireModal({
  animalId,
  applicationId,
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  initialForm,
  onClose,
  onSaved,
}: AdoptionQuestionnaireModalProps) {
  const isEdit = applicationId != null;
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<AdoptionQuestionnaireForm>(() => ({
    ...emptyAdoptionQuestionnaireForm(),
    ...initialForm,
    name: initialForm?.name ?? initialName,
    email: initialForm?.email ?? initialEmail,
    phone: displayPhoneFromStored(initialForm?.phone ?? initialPhone),
  }));
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [step1Touched, setStep1Touched] = useState({
    name: false,
    age: false,
    phone: false,
    email: false,
  });
  const [step1ShowErrors, setStep1ShowErrors] = useState(false);

  const step1Errors = useMemo(() => getStep1FieldErrors(form), [form]);
  const showPhoneFieldError =
    Boolean(step1Errors.phone) &&
    (step1ShowErrors || step1Touched.phone || normalizePhoneDigits(form.phone).length > 0);

  const patch = useCallback((p: Partial<AdoptionQuestionnaireForm>) => {
    setForm((prev) => ({ ...prev, ...p }));
  }, []);

  useEffect(() => {
    if (initialName) patch({ name: initialName });
    if (initialEmail) patch({ email: initialEmail });
    if (initialPhone) patch({ phone: displayPhoneFromStored(initialPhone) });
  }, [initialName, initialEmail, initialPhone, patch]);

  const goNext = () => {
    if (step === 1) setStep1ShowErrors(true);
    const err = validateStep(step, form);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const goBack = () => {
    setError("");
    if (step > 1) setStep((s) => s - 1);
  };

  const submit = () => {
    const err = validateStep(TOTAL_STEPS, form);
    if (err) {
      setError(err);
      return;
    }
    setSending(true);
    setError("");
    const body = mapAdoptionQuestionnaireToApiBody(form);
    const request = isEdit
      ? meApplicationsApi.patch(applicationId, body)
      : meApplicationsApi.create({ animal_id: animalId, ...body });
    void request
      .then(() => {
        setSuccess(true);
        onSaved?.();
      })
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : isEdit
              ? "Не удалось сохранить изменения. Попробуйте позже."
              : "Не удалось отправить анкету. Попробуйте позже."
        )
      )
      .finally(() => setSending(false));
  };

  const renderStep = () => {
    if (success) {
      return (
        <div className={styles.successBody}>
          <img src="/lapa-reg.svg" alt="" className={styles.pawIcon} />
          <p className={styles.successTitle}>
            {isEdit ? "Изменения сохранены!" : "Анкета отправлена!"}
          </p>
          <p className={styles.successText}>
            {isEdit
              ? "Организация увидит обновлённую анкету."
              : "Организация рассмотрит её и свяжется с вами в ближайшее время"}
          </p>
        </div>
      );
    }

    switch (step) {
      case 1:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Имя
              <input
                className={`${styles.fieldInput} ${
                  (step1ShowErrors || step1Touched.name) && step1Errors.name ? styles.fieldInputInvalid : ""
                }`.trim()}
                placeholder="Введите ваше имя"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                onBlur={() => setStep1Touched((t) => ({ ...t, name: true }))}
                disabled={sending}
                aria-invalid={Boolean((step1ShowErrors || step1Touched.name) && step1Errors.name)}
              />
              {(step1ShowErrors || step1Touched.name) && step1Errors.name ? (
                <span className={styles.fieldError} role="alert">
                  {step1Errors.name}
                </span>
              ) : null}
            </label>
            <label className={styles.fieldLabel}>
              Возраст
              <input
                className={`${styles.fieldInput} ${
                  (step1ShowErrors || step1Touched.age) && step1Errors.age ? styles.fieldInputInvalid : ""
                }`.trim()}
                placeholder="Введите полное количество лет"
                inputMode="numeric"
                value={form.age}
                onChange={(e) => patch({ age: e.target.value.replace(/\D/g, "") })}
                onBlur={() => setStep1Touched((t) => ({ ...t, age: true }))}
                disabled={sending}
                aria-invalid={Boolean((step1ShowErrors || step1Touched.age) && step1Errors.age)}
              />
              {(step1ShowErrors || step1Touched.age) && step1Errors.age ? (
                <span className={styles.fieldError} role="alert">
                  {step1Errors.age}
                </span>
              ) : null}
            </label>
            <label className={styles.fieldLabel}>
              Телефон
              <PhoneInput
                id="adoption-phone"
                value={form.phone}
                onChange={(phone) => patch({ phone })}
                onBlur={() => setStep1Touched((t) => ({ ...t, phone: true }))}
                disabled={sending}
                error={showPhoneFieldError ? step1Errors.phone : null}
                inputClassName={`${styles.fieldInput} ${
                  showPhoneFieldError ? styles.fieldInputInvalid : ""
                }`.trim()}
                errorClassName={styles.fieldError}
              />
            </label>
            <label className={styles.fieldLabel}>
              E-mail
              <input
                className={`${styles.fieldInput} ${
                  (step1ShowErrors || step1Touched.email) && step1Errors.email ? styles.fieldInputInvalid : ""
                }`.trim()}
                type="email"
                placeholder="Введите ваш E-mail"
                value={form.email}
                onChange={(e) => patch({ email: e.target.value })}
                onBlur={() => setStep1Touched((t) => ({ ...t, email: true }))}
                disabled={sending}
                aria-invalid={Boolean((step1ShowErrors || step1Touched.email) && step1Errors.email)}
              />
              {(step1ShowErrors || step1Touched.email) && step1Errors.email ? (
                <span className={styles.fieldError} role="alert">
                  {step1Errors.email}
                </span>
              ) : null}
            </label>
          </div>
        );
      case 2:
        return (
          <div className={styles.gridTwo}>
            <label className={styles.fieldLabel}>
              Тип жилья
              <ChoicePair
                value={form.housingType}
                onChange={(v) => patch({ housingType: v as AdoptionQuestionnaireForm["housingType"] })}
                options={[
                  { value: "apartment", label: "Квартира" },
                  { value: "house", label: "Дом" },
                ]}
              />
            </label>
            <label className={styles.fieldLabel}>
              Собственность
              <ChoicePair
                value={form.ownership}
                onChange={(v) => patch({ ownership: v as AdoptionQuestionnaireForm["ownership"] })}
                options={[
                  { value: "own", label: "Своё" },
                  { value: "rented", label: "Съёмное" },
                ]}
              />
            </label>
            <label className={styles.fieldLabel}>
              Есть ли согласие всех проживающих?
              <YesNoPair value={form.residentsConsent} onChange={(v) => patch({ residentsConsent: v })} />
            </label>
            <label className={styles.fieldLabel}>
              Есть ли дети?
              <YesNoPair value={form.hasChildren} onChange={(v) => patch({ hasChildren: v })} />
            </label>
            <label className={styles.fieldLabel}>
              Есть ли аллергия?
              <YesNoPair value={form.hasAllergy} onChange={(v) => patch({ hasAllergy: v })} />
            </label>
          </div>
        );
      case 3:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Были ли животные раньше?
              <YesNoPair value={form.hadPetsBefore} onChange={(v) => patch({ hadPetsBefore: v })} />
            </label>
            <label className={styles.fieldLabel}>
              Есть ли питомцы сейчас?
              <YesNoPair value={form.hasPetsNow} onChange={(v) => patch({ hasPetsNow: v })} />
            </label>
            <label className={styles.fieldLabel}>
              Расскажите о вашем опыте
              <textarea
                className={styles.fieldTextarea}
                value={form.experience}
                onChange={(e) => patch({ experience: e.target.value })}
                disabled={sending}
              />
            </label>
          </div>
        );
      case 4:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Почему сейчас?
              <input
                className={styles.fieldInput}
                placeholder="Для чего берете"
                value={form.whyNow}
                onChange={(e) => patch({ whyNow: e.target.value })}
                disabled={sending}
              />
            </label>
            <label className={styles.fieldLabel}>
              Кого именно ищете?
              <textarea
                className={styles.fieldTextarea}
                placeholder="Возраст, темперамент"
                value={form.lookingFor}
                onChange={(e) => patch({ lookingFor: e.target.value })}
                disabled={sending}
              />
            </label>
          </div>
        );
      case 5:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Готовы ли к расходам на врача?
              <YesNoPair
                value={form.readyForVetExpenses}
                onChange={(v) => patch({ readyForVetExpenses: v })}
              />
            </label>
            <label className={styles.fieldLabel}>
              Чем планируете кормить?
              <input
                className={styles.fieldInput}
                placeholder="Укажите тип или марку корма"
                value={form.feedingPlan}
                onChange={(e) => patch({ feedingPlan: e.target.value })}
                disabled={sending}
              />
            </label>
            <label className={styles.fieldLabel}>
              Готовы ли вы вакцинировать / обрабатывать?
              <YesNoPair
                value={form.readyForVaccination}
                onChange={(v) => patch({ readyForVaccination: v })}
              />
            </label>
          </div>
        );
      case 6:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Сколько времени будете уделять?
              <input
                className={styles.fieldInput}
                value={form.timeCommitment}
                onChange={(e) => patch({ timeCommitment: e.target.value })}
                disabled={sending}
              />
            </label>
            <label className={styles.fieldLabel}>
              С кем оставите в отпуске?
              <input
                className={styles.fieldInput}
                value={form.vacationCare}
                onChange={(e) => patch({ vacationCare: e.target.value })}
                disabled={sending}
              />
            </label>
            <label className={styles.fieldLabel}>
              Что сделаете, если придется вернуть?
              <textarea
                className={styles.fieldTextarea}
                placeholder="Опишите ваши действия"
                value={form.returnPlan}
                onChange={(e) => patch({ returnPlan: e.target.value })}
                disabled={sending}
              />
            </label>
          </div>
        );
      case 7:
        return (
          <div className={styles.formStack}>
            <label className={styles.fieldLabel}>
              Готовы подписать договор?
              <YesNoPair value={form.readyForContract} onChange={(v) => patch({ readyForContract: v })} />
            </label>
            <label className={styles.fieldLabel}>
              Готовы показать условия жизни?
              <YesNoPair
                value={form.readyToShowConditions}
                onChange={(v) => patch({ readyToShowConditions: v })}
              />
            </label>
            <label className={styles.fieldLabel}>
              Готовы поддерживать связь после пристроя?
              <YesNoPair value={form.readyToKeepInTouch} onChange={(v) => patch({ readyToKeepInTouch: v })} />
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={() => !sending && onClose()}
    >
      <div
        className={styles.shell}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adoption-questionnaire-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="adoption-questionnaire-title" className={styles.title}>
            Анкета будущего владельца
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Закрыть"
            disabled={sending}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <Stepper step={step} success={success} />

        <div className={styles.body}>
          {renderStep()}
          {error ? <p className={styles.errorText}>{error}</p> : null}
        </div>

        <footer
          className={[
            styles.footer,
            step === 1 && !success ? styles.footerEndOnly : "",
            success ? styles.footerCenter : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {success ? (
            <Link href="/help" className={styles.primaryBtn} onClick={onClose}>
              Вернуться в каталог
            </Link>
          ) : (
            <>
              {step > 1 ? (
                <button type="button" className={styles.backBtn} disabled={sending} onClick={goBack}>
                  Назад
                </button>
              ) : (
                <span />
              )}
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={
                    sending ||
                    (step === 1 && Object.keys(step1Errors).length > 0 && step1ShowErrors)
                  }
                  onClick={goNext}
                >
                  Далее
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={sending}
                  onClick={submit}
                >
                  {sending ? "Отправка…" : "Завершить"}
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
