export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DayPart = "morning" | "day" | "evening";

export type DayAvailabilitySlots = {
  morning: boolean;
  day: boolean;
  evening: boolean;
};

export type AvailabilityGridState = Record<WeekdayKey, DayAvailabilitySlots>;

export const WEEKDAY_KEYS: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_EDIT_LABELS: Record<WeekdayKey, string> = {
  mon: "понедельник",
  tue: "вторник",
  wed: "среда",
  thu: "четверг",
  fri: "пятница",
  sat: "суббота",
  sun: "воскресенье",
};

export const WEEKDAY_CARD_LABELS: Record<WeekdayKey, string> = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье",
};

export const AVAILABILITY_PERIOD_COLUMNS: { key: DayPart; title: string; range: string }[] = [
  { key: "morning", title: "Утро", range: "08:00-12:00" },
  { key: "day", title: "День", range: "12:00-18:00" },
  { key: "evening", title: "Вечер", range: "18:00-23:00" },
];

const PERIOD_ORDER: DayPart[] = ["morning", "day", "evening"];

const PERIOD_RANGE: Record<DayPart, [string, string]> = {
  morning: ["08:00", "12:00"],
  day: ["12:00", "18:00"],
  evening: ["18:00", "23:00"],
};

export function emptyAvailabilityGrid(): AvailabilityGridState {
  const base = {} as AvailabilityGridState;
  for (const k of WEEKDAY_KEYS) {
    base[k] = { morning: false, day: false, evening: false };
  }
  return base;
}

export function normalizeAvailabilityGrid(raw: unknown): AvailabilityGridState {
  const base = emptyAvailabilityGrid();
  if (!raw || typeof raw !== "object") return base;

  for (const k of WEEKDAY_KEYS) {
    const row = (raw as Record<string, unknown>)[k];
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    base[k] = {
      morning: Boolean(o.morning),
      day: Boolean(o.day),
      evening: Boolean(o.evening),
    };
  }
  return base;
}

function mergeSelectedPeriodLabels(selectedOrdered: DayPart[]): string {
  if (selectedOrdered.length === 0) return "";

  const segments = selectedOrdered.map((p) => PERIOD_RANGE[p]);
  const merged: [string, string][] = [];
  for (const seg of segments) {
    if (merged.length === 0) {
      merged.push([seg[0], seg[1]]);
      continue;
    }
    const last = merged[merged.length - 1];
    if (last[1] === seg[0]) {
      last[1] = seg[1];
    } else {
      merged.push([seg[0], seg[1]]);
    }
  }

  return merged.map(([from, to]) => `${from} – ${to}`).join(", ");
}

export interface AvailabilitySlice {
  availabilityGrid: AvailabilityGridState;
  availabilityAroundClock: boolean;
}

export function buildAvailabilityCardRows(slice: AvailabilitySlice): { left: string; right: string }[] {
  const rows: { left: string; right: string }[] = [];

  if (slice.availabilityAroundClock) {
    for (const key of WEEKDAY_KEYS) {
      rows.push({
        left: WEEKDAY_CARD_LABELS[key],
        right: "Круглосуточно",
      });
    }
    return rows;
  }

  for (const key of WEEKDAY_KEYS) {
    const cell = slice.availabilityGrid[key];
    if (!cell) continue;
    const selected = PERIOD_ORDER.filter((p) => cell[p]);
    if (selected.length === 0) continue;
    const label = mergeSelectedPeriodLabels(selected);
    if (label) rows.push({ left: WEEKDAY_CARD_LABELS[key], right: label });
  }

  return rows;
}

export function hasAvailabilityGridSelection(slice: AvailabilitySlice): boolean {
  if (slice.availabilityAroundClock) return true;
  return WEEKDAY_KEYS.some((k) => {
    const c = slice.availabilityGrid[k];
    return c && (c.morning || c.day || c.evening);
  });
}

export function formatAvailabilitySummary(slice: AvailabilitySlice): string {
  if (slice.availabilityAroundClock) {
    return "Круглосуточно (все дни)";
  }
  const rows = buildAvailabilityCardRows(slice);
  if (rows.length === 0) return "";
  return rows.map((r) => `${r.left}: ${r.right}`).join("; ");
}

export function availabilityGridToLegacyMultiline(slice: AvailabilitySlice): string {
  return buildAvailabilityCardRows(slice)
    .map((row) => `${row.left} ${row.right}`)
    .join("\n");
}
