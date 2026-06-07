import type { MeVolunteerProfileOut } from "@/shared/api/endpoints/meProfile";
import { geocodeViaAppProxy } from "@/shared/lib/geocodeCity";
import { buildGeocodeQueryVariants, withRussiaSuffix } from "@/shared/lib/geocodeQueryVariants";

export type MapCoords = [number, number];

export function buildVolunteerLocationQuery(
  locationCity: string | null | undefined,
  locationDistrict?: string | null,
): string {
  const city = (locationCity ?? "").trim();
  const district = (locationDistrict ?? "").trim();
  if (city && district) return `${city}, ${district}`;
  return city || district;
}

export function gatherVolunteerLocationQuery(
  profile: MeVolunteerProfileOut | null | undefined,
  storedLocationText?: string | null,
): string {
  const fromApi = buildVolunteerLocationQuery(profile?.location_city, profile?.location_district);
  if (fromApi) return fromApi;
  return (storedLocationText ?? "").trim();
}

type YGeocodeResult = {
  geoObjects: {
    get: (index: number) => {
      geometry: { getCoordinates: () => number[] };
    } | null;
  };
};

function coordsFromYmapsResult(res: YGeocodeResult): MapCoords | null {
  const first = res.geoObjects.get(0);
  if (!first) return null;
  const c = first.geometry.getCoordinates();
  if (!Array.isArray(c) || c.length < 2) return null;
  const lat = Number(c[0]);
  const lon = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

function ymapsApi(): {
  ready: (cb: () => void) => void;
  geocode: (query: string, options?: { results?: number }) => Promise<YGeocodeResult>;
} | null {
  if (typeof window === "undefined") return null;
  const ymaps = window.ymaps as {
    ready?: (cb: () => void) => void;
    geocode?: (query: string, options?: { results?: number }) => Promise<YGeocodeResult>;
  } | undefined;
  if (!ymaps?.ready || !ymaps.geocode) return null;
  return ymaps as {
    ready: (cb: () => void) => void;
    geocode: (query: string, options?: { results?: number }) => Promise<YGeocodeResult>;
  };
}

export function waitForYmapsReady(timeoutMs = 15_000): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const api = ymapsApi();
      if (api) {
        api.ready(() => resolve(true));
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 80);
    };
    tick();
  });
}

export function geocodeWithYmaps(query: string): Promise<MapCoords | null> {
  const q = withRussiaSuffix(query);
  if (!q) return Promise.resolve(null);

  const api = ymapsApi();
  if (!api) return Promise.resolve(null);

  return new Promise((resolve) => {
    api.ready(() => {
      api
        .geocode(q, { results: 1 })
        .then((res) => resolve(coordsFromYmapsResult(res)))
        .catch(() => resolve(null));
    });
  });
}

export async function geocodeVolunteerLocation(query: string, options?: { waitYmaps?: boolean }): Promise<MapCoords | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const viaProxy = await geocodeViaAppProxy(trimmed);
  if (viaProxy) return viaProxy;

  const hasMapsKey = Boolean(process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim());
  const shouldWait = options?.waitYmaps !== false && hasMapsKey;
  const variants = buildGeocodeQueryVariants(trimmed);

  const tryYmaps = async (q: string) => geocodeWithYmaps(q);

  if (shouldWait) {
    const ready = await waitForYmapsReady();
    if (ready) {
      for (const variant of variants) {
        const viaYmaps = await tryYmaps(variant);
        if (viaYmaps) return viaYmaps;
      }
    }
  } else {
    for (const variant of variants) {
      const viaYmaps = await tryYmaps(variant);
      if (viaYmaps) return viaYmaps;
    }
  }

  return null;
}

export async function resolveVolunteerMapCenter(
  profile: MeVolunteerProfileOut | null | undefined,
  storedLocationText?: string | null,
): Promise<{ center: MapCoords | null; locationQuery: string; usedStoredText: boolean }> {
  const locationQuery = gatherVolunteerLocationQuery(profile, storedLocationText);
  const usedStoredText = Boolean(
    locationQuery && !buildVolunteerLocationQuery(profile?.location_city, profile?.location_district),
  );

  if (locationQuery) {
    const fromText = await geocodeVolunteerLocation(locationQuery, { waitYmaps: true });
    if (fromText && isPlausibleRussiaCoords(fromText[0], fromText[1])) {
      return { center: fromText, locationQuery, usedStoredText };
    }
  }

  const lat = profile?.latitude;
  const lon = profile?.longitude;
  if (
    profile &&
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lon === "number" &&
    Number.isFinite(lon) &&
    isPlausibleRussiaCoords(lat, lon)
  ) {
    return { center: [lat, lon], locationQuery, usedStoredText };
  }

  return { center: null, locationQuery, usedStoredText };
}

export function volunteerProfileNeedsCoordsSync(
  profile: MeVolunteerProfileOut,
  coords: MapCoords,
): boolean {
  const lat = profile.latitude;
  const lon = profile.longitude;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return true;
  }
  const eps = 0.02;
  return Math.abs(lat - coords[0]) > eps || Math.abs(lon - coords[1]) > eps;
}

export function isPlausibleRussiaCoords(lat: number, lon: number): boolean {
  return lat >= 41 && lat <= 82 && lon >= 19 && lon <= 169;
}

export function buildTaskLocationQuery(city: string | null | undefined, address: string | null | undefined): string {
  const c = (city ?? "").trim();
  const a = (address ?? "").trim();
  if (a && c) return `${a}, ${c}`;
  return a || c;
}

export type LocatedTaskCoords = { lat: number; lon: number };

const taskCoordsCache = new Map<string, LocatedTaskCoords | null>();

export async function resolveTaskMapCoords(
  task: { id: number; city?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null },
  fallbackCenter: MapCoords | null,
): Promise<LocatedTaskCoords> {
  const lat = task.latitude;
  const lon = task.longitude;
  if (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lon === "number" &&
    Number.isFinite(lon) &&
    isPlausibleRussiaCoords(lat, lon)
  ) {
    return { lat, lon };
  }

  const query = buildTaskLocationQuery(task.city, task.address);
  const cityOnly = (task.city ?? "").trim();
  const queriesToTry = query ? [query, ...(cityOnly && cityOnly !== query ? [cityOnly] : [])] : cityOnly ? [cityOnly] : [];

  for (const q of queriesToTry) {
    const cached = taskCoordsCache.get(q);
    if (cached !== undefined) {
      if (cached) return cached;
      continue;
    }
    const geocoded = await geocodeVolunteerLocation(q, { waitYmaps: true });
    const resolved = geocoded && isPlausibleRussiaCoords(geocoded[0], geocoded[1])
      ? { lat: geocoded[0], lon: geocoded[1] }
      : null;
    taskCoordsCache.set(q, resolved);
    if (resolved) return resolved;
  }

  const [dx, dy] = [
    (((task.id * 7919) % 1001) / 1001 - 0.5) * 0.04,
    (((task.id * 4177) % 1001) / 1001 - 0.5) * 0.04,
  ];
  const base = fallbackCenter ?? [59.9343, 30.3351];
  return { lat: base[0] + dx, lon: base[1] + dy };
}

export async function locateVolunteerTasksOnMap<T extends { id: number; city?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null }>(
  items: T[],
  userCenter: MapCoords | null,
): Promise<Array<T & LocatedTaskCoords>> {
  return Promise.all(
    items.map(async (item) => {
      const coords = await resolveTaskMapCoords(item, userCenter);
      return { ...item, ...coords };
    }),
  );
}

export function volunteerProfileNeedsCitySync(
  profile: MeVolunteerProfileOut,
  locationCity: string,
): boolean {
  const apiCity = (profile.location_city ?? "").trim();
  return Boolean(locationCity) && apiCity !== locationCity.trim();
}
