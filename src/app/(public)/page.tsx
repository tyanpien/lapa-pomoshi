import type { Animal } from "@/shared/api/endpoints/animals";
import { animalsApi } from "@/shared/api/endpoints/animals";
import type { EventItem } from "@/shared/api/endpoints/events";
import { eventsApi } from "@/shared/api/endpoints/events";
import type { Organization } from "@/shared/api/endpoints/organizations";
import { organizationsApi } from "@/shared/api/endpoints/organizations";
import type { UrgentItem } from "@/shared/api/endpoints/urgent";
import { urgentApi } from "@/shared/api/endpoints/urgent";
import { normalizeUrgentFeedItems } from "@/shared/lib/urgentFeedNormalize";
import HomePageClient from "./HomePageClient";

export const revalidate = 120;

const HOME_DATA_TIMEOUT_MS = 10_000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("home-data-timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadHomePageData(): Promise<{
  urgentList: UrgentItem[];
  animals: Animal[];
  organizations: Organization[];
  homeEvents: EventItem[];
}> {
  const settled = await withTimeout(
    Promise.allSettled([
      urgentApi.getList({ limit: 100 }),
      animalsApi.getList(),
      organizationsApi.getList(),
      eventsApi.getList(),
    ]),
    HOME_DATA_TIMEOUT_MS
  ).catch(() => [{ status: "rejected" as const, reason: null }, { status: "rejected" as const, reason: null }, { status: "rejected" as const, reason: null }, { status: "rejected" as const, reason: null }]);

  let urgentList: UrgentItem[] = [];
  if (settled[0].status === "fulfilled") {
    const raw = settled[0].value.items ?? [];
    urgentList = normalizeUrgentFeedItems(raw.filter((i: UrgentItem) => i.is_urgent));
  }

  const animals = settled[1].status === "fulfilled" ? ((settled[1].value as { items?: Animal[] }).items ?? []) : [];

  const organizations =
    settled[2].status === "fulfilled"
      ? (((settled[2].value as { items?: Organization[] }).items ?? []) as Organization[])
      : [];

  const homeEvents =
    settled[3].status === "fulfilled"
      ? ((settled[3].value as { items?: EventItem[] }).items ?? []).slice(0, 3)
      : [];

  return { urgentList, animals, organizations, homeEvents };
}

export default async function HomePage() {
  const data = await loadHomePageData();
  return <HomePageClient {...data} />;
}
