import type { UrgentItem } from "@/shared/api/endpoints/urgent";

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
