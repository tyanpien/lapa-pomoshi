const FUNDRAISING_HELP_TYPES = new Set(["financial", "food", "medical", "feed"]);

export function isHelpRequestDraft(
  item?: { is_published?: boolean } | null,
  raw?: Record<string, unknown> | null
): boolean {
  if (raw && raw.is_published === false) return true;
  return item?.is_published === false;
}

export function isFundraisingHelpType(helpType: string | null | undefined): boolean {
  const h = (helpType ?? "").trim().toLowerCase();
  return FUNDRAISING_HELP_TYPES.has(h);
}

export function isVolunteerTaskRequest(
  item: { help_type: string; volunteer_needed?: boolean },
  raw?: Record<string, unknown> | null
): boolean {
  const typeGroup =
    raw && typeof raw.type_group === "string" ? raw.type_group.trim().toLowerCase() : "";
  if (typeGroup === "volunteer_task") return true;
  if (typeGroup === "fundraising") return false;
  if (item.volunteer_needed) return true;
  return !isFundraisingHelpType(item.help_type);
}

export function isCollectionRequest(
  item: { help_type: string; volunteer_needed?: boolean },
  raw?: Record<string, unknown> | null
): boolean {
  return !isVolunteerTaskRequest(item, raw);
}

export type VolunteerTaskDescriptionParts = {
  intro: string;
  route: string | null;
  whatToDo: string | null;
  extra: string | null;
};

export function parseVolunteerTaskDescription(text: string): VolunteerTaskDescriptionParts {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return { intro: "", route: null, whatToDo: null, extra: null };

  const findBlock = (pattern: RegExp): { index: number; length: number } | null => {
    const m = pattern.exec(raw);
    if (!m || m.index === undefined) return null;
    return { index: m.index, length: m[0].length };
  };

  const routeMark = findBlock(/\n\s*маршрут\s*:\s*\n?/i) ?? findBlock(/^маршрут\s*:\s*\n?/i);
  const taskMark = findBlock(/\n\s*что нужно сделать\s*:\s*/i) ?? findBlock(/^что нужно сделать\s*:\s*/i);
  const extraMark = findBlock(/\n\s*дополнительно\s*:\s*/i) ?? findBlock(/^дополнительно\s*:\s*/i);

  const marks = [
    routeMark && { key: "route" as const, ...routeMark },
    taskMark && { key: "task" as const, ...taskMark },
    extraMark && { key: "extra" as const, ...extraMark },
  ]
    .filter(Boolean)
    .sort((a, b) => a!.index - b!.index) as {
    key: "route" | "task" | "extra";
    index: number;
    length: number;
  }[];

  if (!marks.length) {
    return { intro: raw, route: null, whatToDo: null, extra: null };
  }

  const intro = raw.slice(0, marks[0].index).trim();
  const parts: VolunteerTaskDescriptionParts = {
    intro,
    route: null,
    whatToDo: null,
    extra: null,
  };

  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i].index + marks[i].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : raw.length;
    const chunk = raw.slice(start, end).trim();
    if (marks[i].key === "route") parts.route = chunk;
    if (marks[i].key === "task") parts.whatToDo = chunk;
    if (marks[i].key === "extra") parts.extra = chunk;
  }

  return parts;
}
