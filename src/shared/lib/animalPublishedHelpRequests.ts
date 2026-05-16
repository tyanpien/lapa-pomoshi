import { helpApi } from "@/shared/api/endpoints/help";
import { urgentApi } from "@/shared/api/endpoints/urgent";

function isOpenUrgentStatus(status: string | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s !== "closed" && s !== "cancelled";
}

export async function fetchAnimalIdsWithPublishedOpenRequests(): Promise<Set<number>> {
  const ids = new Set<number>();
  const [helpRes, urgentRes] = await Promise.all([
    helpApi.getAnimalHelp("all").catch(() => ({ items: [] as { animal_id: number; monetary?: { request_id: number }[] }[] })),
    urgentApi.getList({ limit: 300 }).catch(() => ({ items: [] })),
  ]);

  for (const it of helpRes.items ?? []) {
    if (typeof it.animal_id !== "number" || !Number.isFinite(it.animal_id)) continue;
    if ((it.monetary?.length ?? 0) > 0) ids.add(it.animal_id);
  }

  for (const row of urgentRes.items ?? []) {
    if (typeof row.animal_id !== "number" || !Number.isFinite(row.animal_id)) continue;
    if (!isOpenUrgentStatus(row.status)) continue;
    ids.add(row.animal_id);
  }

  return ids;
}
