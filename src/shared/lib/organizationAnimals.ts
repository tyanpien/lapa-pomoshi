import type { Animal } from "@/shared/api/endpoints/animals";

const ORGANIZATION_ANIMALS_STORAGE_KEY = "organization.animals.v1";
const ORGANIZATION_ANIMALS_EVENT = "organization-animals-updated";

type StoredAnimalRecord = {
  ownerName: string;
  animal: Animal;
};

export type NewOrganizationAnimalInput = {
  name: string;
  species: string;
  breed: string;
  sex: "male" | "female";
  ageMonths: number;
  city: string;
  description: string;
  healthFeatures?: string;
  treatmentRequired?: string;
  characterTags?: string[];
  healthChecklist?: string[];
  healthCareSlugs?: string[];
  healthCareOther?: string;
  characterSlugs?: string[];
  characterOther?: string;
  status: "looking_for_home" | "on_treatment" | "in_shelter";
  isUrgent: boolean;
  photoUrl?: string;
};

const readRecords = (): StoredAnimalRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORGANIZATION_ANIMALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredAnimalRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRecords = (records: StoredAnimalRecord[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORGANIZATION_ANIMALS_STORAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(ORGANIZATION_ANIMALS_EVENT));
};

const getCurrentOrganizationName = () => {
  if (typeof window === "undefined") return "Организация";
  return localStorage.getItem("userName")?.trim() || "Организация";
};

const createAnimalId = () => Date.now();

export const getOrganizationAnimalsEventName = () => ORGANIZATION_ANIMALS_EVENT;

export const getAllOrganizationAnimals = (): Animal[] => {
  return readRecords().map((record) => record.animal);
};

export const ORGANIZATION_ANIMAL_STATUS_LOOKING_FOR_HOME = "looking_for_home" as const;

export const isOrganizationAnimalPublishedToHomeCatalog = (animal: Animal): boolean =>
  animal.status === ORGANIZATION_ANIMAL_STATUS_LOOKING_FOR_HOME;

export const getOrganizationAnimalsPublishedToHomeCatalog = (): Animal[] =>
  getAllOrganizationAnimals().filter(isOrganizationAnimalPublishedToHomeCatalog);

export const getCurrentOrganizationAnimals = (): Animal[] => {
  const currentOrganizationName = getCurrentOrganizationName();
  return readRecords()
    .filter((record) => record.ownerName === currentOrganizationName)
    .map((record) => record.animal);
};

export const getOrganizationAnimalsByName = (organizationName: string): Animal[] => {
  const normalizedName = organizationName.trim().toLowerCase();
  if (!normalizedName) return [];

  return readRecords()
    .filter(
      (record) =>
        record.ownerName.trim().toLowerCase() === normalizedName ||
        (record.animal.organization_name || "").trim().toLowerCase() === normalizedName
    )
    .map((record) => record.animal);
};

export const getOrganizationAnimalById = (id: number): Animal | null => {
  const target = readRecords().find((record) => record.animal.id === id);
  return target?.animal ?? null;
};

export const addOrganizationAnimal = (input: NewOrganizationAnimalInput): Animal => {
  const organizationName = getCurrentOrganizationName();
  const normalizedSpecies = input.species.trim() || "Собака";
  const createdAnimal: Animal = {
    id: createAnimalId(),
    name: input.name.trim(),
    species: normalizedSpecies,
    breed: input.breed.trim() || "Метис",
    sex: input.sex,
    age_months: Math.max(0, Number(input.ageMonths) || 0),
    location_city: input.city.trim() || null,
    is_urgent: input.isUrgent,
    status: input.status,
    full_description: input.description.trim(),
    primary_photo_url: input.photoUrl?.trim() || null,
    photo_urls: input.photoUrl?.trim() ? [input.photoUrl.trim()] : [],
    organization: {
      id: 0,
      name: organizationName,
      city: input.city.trim() || "Не указан",
    },
    organization_name: organizationName,
    health_features: input.healthFeatures?.trim() || "",
    treatment_required: input.treatmentRequired?.trim() || "",
    character_tags: input.characterTags ?? [],
    health_checklist: input.healthChecklist ?? [],
    health_care_slugs: input.healthCareSlugs ?? [],
    health_care_other: input.healthCareOther?.trim() || null,
    character_slugs: input.characterSlugs ?? [],
    character_other: input.characterOther?.trim() || null,
    catalog_features: [],
  };

  const records = readRecords();
  records.unshift({
    ownerName: organizationName,
    animal: createdAnimal,
  });
  writeRecords(records);
  return createdAnimal;
};

export const updateOrganizationAnimal = (id: number, input: NewOrganizationAnimalInput): Animal | null => {
  const records = readRecords();
  const recordIndex = records.findIndex((record) => record.animal.id === id);
  if (recordIndex === -1) return null;

  const currentOrganizationName = getCurrentOrganizationName();
  if (records[recordIndex].ownerName !== currentOrganizationName) return null;

  const normalizedSpecies = input.species.trim() || "Собака";
  const prev = records[recordIndex].animal;
  const updatedAnimal: Animal = {
    ...prev,
    name: input.name.trim(),
    species: normalizedSpecies,
    breed: input.breed.trim() || "Метис",
    sex: input.sex,
    age_months: Math.max(0, Number(input.ageMonths) || 0),
    location_city: input.city.trim() || null,
    is_urgent: input.isUrgent,
    status: input.status,
    full_description: input.description.trim(),
    primary_photo_url: input.photoUrl?.trim() || prev.primary_photo_url || null,
    photo_urls: input.photoUrl?.trim()
      ? [input.photoUrl.trim()]
      : prev.photo_urls?.length
        ? [...prev.photo_urls]
        : prev.primary_photo_url
          ? [prev.primary_photo_url]
          : [],
    organization_name: currentOrganizationName,
    health_features: input.healthFeatures?.trim() || "",
    treatment_required: input.treatmentRequired?.trim() || "",
    character_tags: input.characterTags ?? [],
    health_checklist: input.healthChecklist ?? records[recordIndex].animal.health_checklist ?? [],
    health_care_slugs: input.healthCareSlugs ?? records[recordIndex].animal.health_care_slugs ?? [],
    health_care_other: input.healthCareOther?.trim() || records[recordIndex].animal.health_care_other || null,
    character_slugs: input.characterSlugs ?? records[recordIndex].animal.character_slugs ?? [],
    character_other: input.characterOther?.trim() || records[recordIndex].animal.character_other || null,
  };

  records[recordIndex] = {
    ...records[recordIndex],
    animal: updatedAnimal,
  };
  writeRecords(records);
  return updatedAnimal;
};

export const deleteOrganizationAnimal = (id: number): boolean => {
  const currentOrganizationName = getCurrentOrganizationName();
  const records = readRecords();
  const filteredRecords = records.filter(
    (record) => !(record.ownerName === currentOrganizationName && record.animal.id === id)
  );

  if (filteredRecords.length === records.length) return false;
  writeRecords(filteredRecords);
  return true;
};
