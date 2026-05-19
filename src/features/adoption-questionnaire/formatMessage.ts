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

function yesNoToBool(value: YesNo | ""): boolean {
  return value === "yes";
}

function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) digits = digits.slice(0, 10);
  return digits.length >= 10 ? `+7${digits}` : raw.trim();
}

export type AdoptionApplicationApiBody = {
  applicant_name: string;
  applicant_age: number;
  applicant_phone: string;
  applicant_email: string;
  housing_type: "apartment" | "house";
  housing_ownership: "own" | "rented";
  residents_consent: boolean;
  has_children: boolean;
  has_allergy: boolean;
  had_pets_before: boolean;
  has_pets_now: boolean;
  pet_experience: string;
  why_now: string;
  who_looking_for: string;
  ready_for_vet_costs: boolean;
  feeding_plan: string;
  ready_for_vaccination: boolean;
  time_to_devote: string;
  vacation_care: string;
  return_plan: string;
  ready_to_sign_contract: boolean;
  ready_to_show_conditions: boolean;
  ready_to_keep_in_touch: boolean;
};

export function mapAdoptionQuestionnaireToApiBody(form: AdoptionQuestionnaireForm): AdoptionApplicationApiBody {
  const ageRaw = parseInt(form.age.trim(), 10);
  return {
    applicant_name: form.name.trim(),
    applicant_age: Number.isFinite(ageRaw) ? ageRaw : 0,
    applicant_phone: normalizePhoneDigits(form.phone),
    applicant_email: form.email.trim(),
    housing_type: form.housingType as "apartment" | "house",
    housing_ownership: form.ownership as "own" | "rented",
    residents_consent: yesNoToBool(form.residentsConsent),
    has_children: yesNoToBool(form.hasChildren),
    has_allergy: yesNoToBool(form.hasAllergy),
    had_pets_before: yesNoToBool(form.hadPetsBefore),
    has_pets_now: yesNoToBool(form.hasPetsNow),
    pet_experience: form.experience.trim(),
    why_now: form.whyNow.trim(),
    who_looking_for: form.lookingFor.trim(),
    ready_for_vet_costs: yesNoToBool(form.readyForVetExpenses),
    feeding_plan: form.feedingPlan.trim(),
    ready_for_vaccination: yesNoToBool(form.readyForVaccination),
    time_to_devote: form.timeCommitment.trim(),
    vacation_care: form.vacationCare.trim(),
    return_plan: form.returnPlan.trim(),
    ready_to_sign_contract: yesNoToBool(form.readyForContract),
    ready_to_show_conditions: yesNoToBool(form.readyToShowConditions),
    ready_to_keep_in_touch: yesNoToBool(form.readyToKeepInTouch),
  };
}

export function formatAdoptionApplicationFieldsHuman(
  fields: Partial<{ [K in keyof AdoptionApplicationApiBody]: AdoptionApplicationApiBody[K] | null }> & {
    message?: string | null;
  }
): string {
  if (fields.message?.trim()) {
    const parsed = parseAdoptionQuestionnaireMessage(fields.message);
    if (parsed) return formatAdoptionQuestionnaireHuman(parsed);
    const humanPart = fields.message.split("\n\n__ADOPTION_FORM_")[0]?.trim();
    if (humanPart) return humanPart;
  }
  const form = mapAdoptionApiBodyToQuestionnaireForm(fields);
  if (!form.name.trim() && !form.whyNow.trim()) return "—";
  return formatAdoptionQuestionnaireHuman(form);
}

export type AdoptionApplicationApiFieldsInput = Partial<{
  [K in keyof AdoptionApplicationApiBody]: AdoptionApplicationApiBody[K] | null;
}>;

export function mapAdoptionApiBodyToQuestionnaireForm(
  body: AdoptionApplicationApiFieldsInput
): AdoptionQuestionnaireForm {
  const boolToYn = (v: boolean | null | undefined): YesNo | "" =>
    v === true ? "yes" : v === false ? "no" : "";
  return {
    name: body.applicant_name?.trim() ?? "",
    age: body.applicant_age != null ? String(body.applicant_age) : "",
    phone: body.applicant_phone?.trim() ?? "",
    email: body.applicant_email?.trim() ?? "",
    housingType: body.housing_type ?? "",
    ownership: body.housing_ownership ?? "",
    residentsConsent: boolToYn(body.residents_consent),
    hasChildren: boolToYn(body.has_children),
    hasAllergy: boolToYn(body.has_allergy),
    hadPetsBefore: boolToYn(body.had_pets_before),
    hasPetsNow: boolToYn(body.has_pets_now),
    experience: body.pet_experience?.trim() ?? "",
    whyNow: body.why_now?.trim() ?? "",
    lookingFor: body.who_looking_for?.trim() ?? "",
    readyForVetExpenses: boolToYn(body.ready_for_vet_costs),
    feedingPlan: body.feeding_plan?.trim() ?? "",
    readyForVaccination: boolToYn(body.ready_for_vaccination),
    timeCommitment: body.time_to_devote?.trim() ?? "",
    vacationCare: body.vacation_care?.trim() ?? "",
    returnPlan: body.return_plan?.trim() ?? "",
    readyForContract: boolToYn(body.ready_to_sign_contract),
    readyToShowConditions: boolToYn(body.ready_to_show_conditions),
    readyToKeepInTouch: boolToYn(body.ready_to_keep_in_touch),
  };
}
