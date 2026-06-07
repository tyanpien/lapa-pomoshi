import { getLoginHref } from "@/shared/lib/auth/loginHref";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";

export type UrgentHelpSource = Pick<UrgentItem, "id" | "animal_id">;

export function resolveUrgentAnimalId(item: UrgentHelpSource): number | null {
  const id = item.animal_id;
  if (id == null || !Number.isFinite(id) || id < 1) return null;
  return id;
}

export function resolveUrgentHelpPath(item: UrgentHelpSource): string {
  const requestId = item.id;
  const animalId = resolveUrgentAnimalId(item);

  if (animalId != null) {
    const q = new URLSearchParams({ from: "urgent", requestId: String(requestId) });
    return `/catalog/animals/${animalId}?${q.toString()}`;
  }

  const q = new URLSearchParams({ help: "1" });
  return `/urgent/${requestId}?${q.toString()}`;
}

export function resolveUrgentHelpHref(
  item: UrgentHelpSource,
  options?: { authenticated?: boolean; loginReturnPath?: string }
): string {
  const path = resolveUrgentHelpPath(item);
  if (options?.authenticated) return path;
  return getLoginHref(options?.loginReturnPath ?? path);
}
