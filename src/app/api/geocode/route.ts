import { NextResponse } from "next/server";
import { buildGeocodeQueryVariants, withRussiaSuffix } from "@/shared/lib/geocodeQueryVariants";
import { isPlausibleRussiaCoords } from "@/shared/lib/volunteerLocation";

type YandexGeocodeResponse = {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          Point?: { pos?: string };
        };
      }>;
    };
  };
};

type NominatimItem = { lat?: string; lon?: string };

async function yandexGeocode(query: string, apiKey: string): Promise<{ lat: number; lon: number } | null> {
  const geocodeQuery = withRussiaSuffix(query);
  const url = new URL("https://geocode-maps.yandex.ru/1.x/");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("geocode", geocodeQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("results", "1");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as YandexGeocodeResponse;
    const pos = data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject?.Point?.pos;
    if (typeof pos !== "string") return null;
    const [lon, lat] = pos.split(/\s+/).map((x) => Number(x));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

async function nominatimGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const geocodeQuery = withRussiaSuffix(query);
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ru");
  url.searchParams.set("accept-language", "ru");
  url.searchParams.set("q", geocodeQuery);

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent": "LapaPomoshi/1.0 (volunteer map geocoder)",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimItem[];
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "missing q" }, { status: 400 });
  }

  const yandexKey =
    process.env.YANDEX_GEOCODER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    "";

  const variants = buildGeocodeQueryVariants(q);

  for (const variant of variants) {
    if (yandexKey) {
      const y = await yandexGeocode(variant, yandexKey);
      if (y && isPlausibleRussiaCoords(y.lat, y.lon)) return NextResponse.json(y);
    }
    const n = await nominatimGeocode(variant);
    if (n && isPlausibleRussiaCoords(n.lat, n.lon)) return NextResponse.json(n);
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
