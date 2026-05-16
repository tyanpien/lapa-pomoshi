export type YesNo = "yes" | "no";

export type AdoptionQuestionnaireForm = {
  name: string;
  age: string;
  phone: string;
  email: string;
  housingType: "apartment" | "house" | "";
  ownership: "own" | "rented" | "";
  residentsConsent: YesNo | "";
  hasChildren: YesNo | "";
  hasAllergy: YesNo | "";
  hadPetsBefore: YesNo | "";
  hasPetsNow: YesNo | "";
  experience: string;
  whyNow: string;
  lookingFor: string;
  readyForVetExpenses: YesNo | "";
  feedingPlan: string;
  readyForVaccination: YesNo | "";
  timeCommitment: string;
  vacationCare: string;
  returnPlan: string;
  readyForContract: YesNo | "";
  readyToShowConditions: YesNo | "";
  readyToKeepInTouch: YesNo | "";
};

export const emptyAdoptionQuestionnaireForm = (): AdoptionQuestionnaireForm => ({
  name: "",
  age: "",
  phone: "",
  email: "",
  housingType: "",
  ownership: "",
  residentsConsent: "",
  hasChildren: "",
  hasAllergy: "",
  hadPetsBefore: "",
  hasPetsNow: "",
  experience: "",
  whyNow: "",
  lookingFor: "",
  readyForVetExpenses: "",
  feedingPlan: "",
  readyForVaccination: "",
  timeCommitment: "",
  vacationCare: "",
  returnPlan: "",
  readyForContract: "",
  readyToShowConditions: "",
  readyToKeepInTouch: "",
});

export const ADOPTION_FORM_VERSION = "v1";
export const ADOPTION_FORM_PREFIX = `__ADOPTION_FORM_${ADOPTION_FORM_VERSION}__\n`;
