import type { VolunteerSelfPatch } from "@/shared/api/endpoints/meProfile";
import { buildGeocodeQueryVariants } from "@/shared/lib/geocodeQueryVariants";

export async function geocodeViaAppProxy(query: string): Promise<[number, number] | null> {
  const variants = buildGeocodeQueryVariants(query);
  for (const variant of variants) {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(variant)}`, { cache: "no-store" });
      if (!res.ok) continue;
      const body = (await res.json()) as { lat?: number; lon?: number };
      if (typeof body.lat === "number" && typeof body.lon === "number") {
        return [body.lat, body.lon];
      }
    } catch {
    }
  }
  return null;
}

export async function geocodeCityRu(city: string): Promise<[number, number] | null> {
  return geocodeViaAppProxy(city);
}

export async function applyCityGeocodeToVolunteerPatch<T extends VolunteerSelfPatch>(
  patch: T,
  city?: string | null,
): Promise<T> {
  const query = (city ?? patch.location_city ?? "").trim();
  if (!query) return patch;

  const { geocodeVolunteerLocation } = await import("@/shared/lib/volunteerLocation");
  const coords = await geocodeVolunteerLocation(query);
  if (!coords) return patch;

  return { ...patch, latitude: coords[0], longitude: coords[1] };
}
