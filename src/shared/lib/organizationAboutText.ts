const MAIN_TASKS_HEADING_RE = /наши\s+основные\s+задачи\s*:/i;

export function splitOrganizationAboutMainTasksFromPlainText(text: string): { intro: string; tasks: string[] } {
  const trimmed = text.trim();
  if (!trimmed) return { intro: "", tasks: [] };

  const match = trimmed.match(MAIN_TASKS_HEADING_RE);
  if (!match || match.index === undefined) {
    return { intro: trimmed, tasks: [] };
  }

  const intro = trimmed.slice(0, match.index).trim();
  const afterMarker = trimmed.slice(match.index + match[0].length).trim();
  if (!afterMarker) {
    return { intro: trimmed, tasks: [] };
  }

  const lines = afterMarker.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let tasks: string[] = [];
  if (lines.length > 1) {
    tasks = lines.map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  } else {
    tasks = afterMarker
      .split(/\s+-\s+/)
      .map((p) => p.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }

  return { intro, tasks };
}
