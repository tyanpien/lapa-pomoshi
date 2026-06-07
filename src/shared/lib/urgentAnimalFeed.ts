import type { Animal } from "@/shared/api/endpoints/animals";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { getImageUrl } from "@/shared/api/client";

export const ANIMAL_URGENT_CARD_ID_OFFSET = 1_000_000_000;

export function isAnimalOnlyUrgentCard(id: number): boolean {
  return Number.isFinite(id) && id >= ANIMAL_URGENT_CARD_ID_OFFSET;
}

function speciesSlugFromLabel(species: string | null | undefined): string | null {
  const s = (species ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("кот") || s.includes("cat")) return "cat";
  if (s.includes("соб") || s.includes("пёс") || s.includes("pes") || s.includes("dog")) return "dog";
  return null;
}

export function urgentItemFromUrgentAnimal(animal: Animal): UrgentItem {
  const description =
    animal.full_description?.trim() ||
    "Срочно нужна помощь. Откройте карточку, чтобы узнать, как помочь.";

  return {
    id: ANIMAL_URGENT_CARD_ID_OFFSET + animal.id,
    title: animal.name,
    description,
    city: animal.location_city,
    organization_name: animal.organization_name ?? animal.organization?.name ?? "Организация",
    animal_id: animal.id,
    animal_name: animal.name,
    animal_species: speciesSlugFromLabel(animal.species),
    help_type: "financial",
    is_urgent: true,
    volunteer_needed: false,
    deadline_at: null,
    deadline_label: null,
    status: "open",
    target_amount: null,
    primary_photo_url: animal.primary_photo_url ? getImageUrl(animal.primary_photo_url) : null,
    badges: ["срочно"],
  };
}

export function catalogPathForUrgentAnimal(animalId: number): string {
  return `/catalog/animals/${animalId}?from=urgent`;
}
