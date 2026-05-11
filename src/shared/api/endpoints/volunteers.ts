import { apiFetch, getImageUrl } from "../client";

export interface Volunteer {
  user_id: number;
  full_name: string | null;
  avatar_url: string | null;
  rating?: number;
  location_city: string | null;
  experience_level: string | null;
  experience_level_label: string | null;
  completed_tasks_count: number;
  is_available?: boolean;
  competency_tags: string[];
  animal_types: string[];
  travel_radius_km: number | null;
  availability: string | null;
}

export interface VolunteerWeekdayScheduleOut {
  weekday: string;
  weekday_label: string;
  ranges: { start: string; end: string }[];
}

export interface VolunteerPublicLogistics {
  weekly_schedule: VolunteerWeekdayScheduleOut[];
  accepts_night_urgency: boolean;
  night_urgency_label: string | null;
}

export interface VolunteerPublicArticleCard {
  id: number;
  title: string;
  summary: string | null;
  read_minutes: number;
  category: string;
  category_label: string;
}

export interface VolunteerViewerActions {
  can_write_message: boolean;
  can_offer_task: boolean;
}

export interface VolunteerDetail {
  user_id: number;
  full_name: string | null;
  avatar_url: string | null;
  completed_tasks_count: number;
  readiness_status: "available" | "paused";
  readiness_label: string;
  hero_experience_badges: string[];
  location_city: string | null;
  location_district: string | null;
  location_display: string | null;
  help_format: string | null;
  help_format_label: string | null;
  competency_slugs: string[];
  competency_tags: string[];
  animal_category_ids: string[];
  animal_category_labels: string[];
  logistics: VolunteerPublicLogistics | null;
  about_me: string | null;
  articles: VolunteerPublicArticleCard[];
  viewer: VolunteerViewerActions;
  travel_radius_km: number | null;
  reviews?: Review[];
}

export interface Review {
  author_name: string;
  author_avatar_url: string | null;
  review_date: string;
  rating: number;
  text: string;
}

export interface CatalogOption {
  id: string;
  label: string;
}

export interface VolunteersCatalogs {
  cities: string[];
  competencies: CatalogOption[];
  experience_levels: CatalogOption[];
  animal_types: CatalogOption[];
  help_formats?: CatalogOption[];
  travel_area_modes?: CatalogOption[];
  weekdays?: CatalogOption[];
}

function normalizeTimeHHMM(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

function isRoundTheClockWeeklySchedule(sched: VolunteerWeekdayScheduleOut[]): boolean {
  if (sched.length !== 7) return false;
  for (const day of sched) {
    const ranges = day.ranges ?? [];
    if (ranges.length !== 1) return false;
    const { start, end } = ranges[0];
    const ns = normalizeTimeHHMM(start);
    const ne = normalizeTimeHHMM(end);
    if (ns !== "00:00") return false;
    if (ne !== "23:59" && ne !== "24:00") return false;
  }
  return true;
}

export function volunteerAvailabilityText(detail: VolunteerDetail): string {
  const sched = detail.logistics?.weekly_schedule ?? [];
  if (sched.length > 0 && isRoundTheClockWeeklySchedule(sched)) {
    return "Круглосуточно";
  }

  const lines: string[] = [];
  for (const day of sched) {
    const ranges = day.ranges.map((r) => `${r.start}–${r.end}`).join(", ");
    if (day.weekday_label && ranges) lines.push(`${day.weekday_label}: ${ranges}`);
  }
  return lines.join("\n");
}

export const volunteersApi = {
  getList: () => apiFetch("/api/v1/volunteers") as Promise<{ total: number; items: Volunteer[] }>,
  getCatalogs: () => apiFetch("/api/v1/volunteers/catalogs") as Promise<VolunteersCatalogs>,
  getById: (id: number) => apiFetch(`/api/v1/volunteers/${id}`) as Promise<VolunteerDetail>,
  getImageUrl,
};
