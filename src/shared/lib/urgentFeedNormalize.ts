import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { isCollectionRequest } from "@/shared/lib/helpRequestType";
import { isAnimalOnlyUrgentCard } from "@/shared/lib/urgentAnimalFeed";

export function filterUrgentCollectionFeedItems(items: UrgentItem[]): UrgentItem[] {
  return items.filter((item) => {
    if (!item.is_urgent) return false;
    if (isAnimalOnlyUrgentCard(item.id)) return true;
    return isCollectionRequest(item);
  });
}

export function normalizeUrgentFeedItems(items: UrgentItem[]): UrgentItem[] {
  const seenId = new Set<number>();
  const seenAnimal = new Set<number>();
  const out: UrgentItem[] = [];

  for (const item of items) {
    if (seenId.has(item.id)) continue;
    seenId.add(item.id);

    if (typeof item.animal_id === "number" && Number.isFinite(item.animal_id)) {
      if (seenAnimal.has(item.animal_id)) continue;
      seenAnimal.add(item.animal_id);
    }

    out.push(item);
  }

  return out;
}
