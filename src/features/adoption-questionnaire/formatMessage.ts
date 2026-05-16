import {
  ADOPTION_FORM_PREFIX,
  type AdoptionQuestionnaireForm,
  type YesNo,
} from "./types";

const yesNoLabel: Record<YesNo, string> = { yes: "Да", no: "Нет" };

function yn(value: YesNo | ""): string {
  if (!value) return "—";
  return yesNoLabel[value];
}

function housingLabel(value: AdoptionQuestionnaireForm["housingType"]): string {
  if (value === "apartment") return "Квартира";
  if (value === "house") return "Дом";
  return "—";
}

function ownershipLabel(value: AdoptionQuestionnaireForm["ownership"]): string {
  if (value === "own") return "Своё";
  if (value === "rented") return "Съёмное";
  return "—";
}

export function serializeAdoptionQuestionnaire(form: AdoptionQuestionnaireForm): string {
  return `${ADOPTION_FORM_PREFIX}${JSON.stringify(form)}`;
}

export function parseAdoptionQuestionnaireMessage(
  message: string | null | undefined
): AdoptionQuestionnaireForm | null {
  if (!message?.startsWith(ADOPTION_FORM_PREFIX)) return null;
  try {
    return JSON.parse(message.slice(ADOPTION_FORM_PREFIX.length)) as AdoptionQuestionnaireForm;
  } catch {
    return null;
  }
}

export function formatAdoptionQuestionnaireHuman(form: AdoptionQuestionnaireForm): string {
  const lines = [
    "Анкета будущего владельца",
    "",
    "1. Контакты",
    `Имя: ${form.name.trim() || "—"}`,
    `Возраст: ${form.age.trim() || "—"}`,
    `Телефон: ${form.phone.trim() || "—"}`,
    `E-mail: ${form.email.trim() || "—"}`,
    "",
    "2. Жильё",
    `Тип жилья: ${housingLabel(form.housingType)}`,
    `Собственность: ${ownershipLabel(form.ownership)}`,
    `Согласие проживающих: ${yn(form.residentsConsent)}`,
    `Дети: ${yn(form.hasChildren)}`,
    `Аллергия: ${yn(form.hasAllergy)}`,
    "",
    "3. Опыт",
    `Животные раньше: ${yn(form.hadPetsBefore)}`,
    `Питомцы сейчас: ${yn(form.hasPetsNow)}`,
    `Опыт: ${form.experience.trim() || "—"}`,
    "",
    "4. Мотивация",
    `Почему сейчас: ${form.whyNow.trim() || "—"}`,
    `Кого ищете: ${form.lookingFor.trim() || "—"}`,
    "",
    "5. Уход",
    `Готовы к расходам на врача: ${yn(form.readyForVetExpenses)}`,
    `Кормление: ${form.feedingPlan.trim() || "—"}`,
    `Вакцинация / обработка: ${yn(form.readyForVaccination)}`,
    "",
    "6. Ответственность",
    `Время: ${form.timeCommitment.trim() || "—"}`,
    `На время отпуска: ${form.vacationCare.trim() || "—"}`,
    `Если придётся вернуть: ${form.returnPlan.trim() || "—"}`,
    "",
    "7. Соглашения",
    `Договор: ${yn(form.readyForContract)}`,
    `Показать условия жизни: ${yn(form.readyToShowConditions)}`,
    `Связь после пристройства: ${yn(form.readyToKeepInTouch)}`,
  ];
  return lines.join("\n");
}

export function formatAdoptionQuestionnaireForApi(form: AdoptionQuestionnaireForm): string {
  return formatAdoptionQuestionnaireHuman(form) + "\n\n" + serializeAdoptionQuestionnaire(form);
}
