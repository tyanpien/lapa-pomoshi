export type VolunteerAvailabilityRow = { left: string; right: string };

const WEEKDAY_MATCHERS: { test: RegExp; label: string }[] = [
  { test: /^понедельник\b/i, label: "Понедельник" },
  { test: /^вторник\b/i, label: "Вторник" },
  { test: /^среда\b/i, label: "Среда" },
  { test: /^четверг\b/i, label: "Четверг" },
  { test: /^пятница\b/i, label: "Пятница" },
  { test: /^суббота\b/i, label: "Суббота" },
  { test: /^воскресенье\b/i, label: "Воскресенье" },
  { test: /^пн\b\.?/i, label: "Пн" },
  { test: /^вт\b\.?/i, label: "Вт" },
  { test: /^ср\b\.?/i, label: "Ср" },
  { test: /^чт\b\.?/i, label: "Чт" },
  { test: /^пт\b\.?/i, label: "Пт" },
  { test: /^сб\b\.?/i, label: "Сб" },
  { test: /^вс\b\.?/i, label: "Вс" },
];

function capitalizeWord(s: string) {
  const t = s.trim();
  if (!t) return t;
  return t.slice(0, 1).toUpperCase() + t.slice(1).toLowerCase();
}

function stripMatchedDayPrefix(line: string, matchLength: number) {
  return line.slice(matchLength).replace(/^[\s,;:–\-—]+/, "").trim();
}

function splitKeyValueChunks(text: string): VolunteerAvailabilityRow[] {
  const parts = text.split(/;\s*/).map((p) => p.trim()).filter(Boolean);
  const rows: VolunteerAvailabilityRow[] = [];

  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx > 0 && idx < part.length - 1) {
      const left = part.slice(0, idx).trim();
      const right = part.slice(idx + 1).trim();
      rows.push({ left: left || part, right: right || "—" });
    } else {
      rows.push({ left: part, right: "" });
    }
  }

  return rows;
}

export function travelRadiusFootnoteKm(km?: number | null): string | null {
  if (km == null || Number.isNaN(Number(km))) return null;
  const n = Number(km);
  if (n <= 0) return null;

  if (n <= 3) return "В своём районе";
  if (n <= 15) return "До 10 км от меня";
  if (n <= 60) return "По всему городу";
  return "Готов выезжать за город";
}

export function parseVolunteerAvailability(raw: string | null | undefined): {
  rows: VolunteerAvailabilityRow[];
  tagChips: string[];
} {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { rows: [], tagChips: [] };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const scheduleUnknown = parsed && typeof parsed === "object" ? (parsed as { schedule?: unknown }).schedule : null;
    if (Array.isArray(scheduleUnknown)) {
      const sch = scheduleUnknown as { day?: string; time?: string; left?: string; right?: string }[];
      const rows = sch
        .map((row) => {
          const left = row.day ?? row.left ?? "";
          const right = row.time ?? row.right ?? "";
          if (!left && !right) return null;
          return { left: left || "День", right: right || "—" };
        })
        .filter(Boolean) as VolunteerAvailabilityRow[];
      const parsedObj = parsed as { tags?: string[] };
      const tags = Array.isArray(parsedObj.tags) ? parsedObj.tags.filter(Boolean) : [];
      return { rows, tagChips: tags };
    }
  } catch {
    
  }

  const pipeParts = trimmed.split("|").map((s) => s.trim()).filter(Boolean);
  if (pipeParts.length === 2 && !trimmed.includes("\n") && !trimmed.includes(";")) {
    return { rows: [{ left: pipeParts[0], right: pipeParts[1] }], tagChips: [] };
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (
    lines.length <= 1 &&
    trimmed.includes(";") &&
    trimmed.includes(":") &&
    !trimmed.includes("\n")
  ) {
    const kvRows = splitKeyValueChunks(trimmed).map((r) => ({
      left: r.left,
      right: r.right.trim() === "" ? "—" : r.right,
    }));
    const nonEmpty = kvRows.some((r) => r.right !== "" || r.left.length > 0);
    if (nonEmpty && kvRows.length > 0) return { rows: kvRows, tagChips: [] };
  }

  const rows: VolunteerAvailabilityRow[] = [];
  const tagChips: string[] = [];

  const tryParseLineAsDaySchedule = (line: string): boolean => {
    for (const { test, label } of WEEKDAY_MATCHERS) {
      const match = line.match(test);
      if (match?.index !== undefined) {
        const after = stripMatchedDayPrefix(line, match.index + match[0].length);
        rows.push({ left: label, right: after || "—" });
        return true;
      }
    }
    const timeSep = line.match(/^(.{2,}?)\s+(\d{1,2}:\d{2}[\s\S]*)$/);
    if (timeSep && timeSep[1].length <= 42) {
      rows.push({
        left: capitalizeWord(timeSep[1]),
        right: timeSep[2].trim(),
      });
      return true;
    }
    return false;
  };

  for (const line of lines) {
    if (!tryParseLineAsDaySchedule(line)) {
      tagChips.push(line);
    }
  }

  if (rows.length === 0 && tagChips.length === lines.length && lines.join("\n") === trimmed) {
    const singleLine = trimmed;
    if (singleLine.includes(";") && singleLine.includes(":")) {
      const kvRows = splitKeyValueChunks(singleLine).map((r) => ({
        left: r.left,
        right: r.right.trim() === "" ? "—" : r.right,
      }));
      return { rows: kvRows, tagChips: [] };
    }
    return { rows: [], tagChips: [singleLine] };
  }

  return { rows, tagChips };
}

export function hasVolunteerLogisticsSection(
  rawAvailability: string | null | undefined,
  travelKm?: number | null
): boolean {
  if (travelRadiusFootnoteKm(travelKm)) return true;

  const trimmed = rawAvailability?.trim() ?? "";
  if (!trimmed) return false;

  if (/ночн(ых|ые|ой)\s+выезд/i.test(trimmed)) return true;

  const { rows, tagChips } = parseVolunteerAvailability(trimmed);
  return rows.length > 0 || tagChips.length > 0;
}
