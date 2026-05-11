export type UrgentDescBlock =
  | { type: "paragraph"; text: string }
  | { type: "routeList"; items: string[] }
  | { type: "labeledLine"; label: string; body: string };

function splitSentences(s: string): string[] {
  if (!s.trim()) return [];
  return s
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function parseUrgentDescription(text: string): UrgentDescBlock[] {
  const raw = text.trim();
  if (!raw) return [];

  const flat = collapseWhitespace(raw);
  const idxRoute = flat.search(/\s*Маршрут:\s*/i);

  if (idxRoute === -1) {
    return splitSentences(flat).map((s) => ({ type: "paragraph" as const, text: s }));
  }

  const intro = flat.slice(0, idxRoute).trim();
  const afterRouteMarker = flat.slice(idxRoute).replace(/^\s*Маршрут:\s*/i, "").trim();

  const idxTodo = afterRouteMarker.search(/\s*Что нужно сделать:?\s*/i);
  const routeBody = idxTodo === -1 ? afterRouteMarker : afterRouteMarker.slice(0, idxTodo).trim();
  const afterTodoMarker =
    idxTodo === -1 ? "" : afterRouteMarker.slice(idxTodo).replace(/^\s*Что нужно сделать:?\s*/i, "").trim();

  const idxExtra = afterTodoMarker.search(/\s*Дополнительно:?\s*/i);
  const todoBody = idxExtra === -1 ? afterTodoMarker : afterTodoMarker.slice(0, idxExtra).trim();
  const extraBody = idxExtra === -1 ? "" : afterTodoMarker.slice(idxExtra).replace(/^\s*Дополнительно:?\s*/i, "").trim();

  const blocks: UrgentDescBlock[] = [];

  for (const s of splitSentences(intro)) {
    blocks.push({ type: "paragraph", text: s });
  }

  if (routeBody) {
    const items = routeBody
      .split("•")
      .map((x) => x.trim())
      .filter(Boolean);
    if (items.length > 0) {
      blocks.push({ type: "routeList", items });
    }
  }

  if (todoBody) {
    blocks.push({ type: "labeledLine", label: "Что нужно сделать:", body: todoBody });
  }
  if (extraBody) {
    blocks.push({ type: "labeledLine", label: "Дополнительно:", body: extraBody });
  }

  return blocks;
}
