const DIALOGS_PAGE_SIZE = 100;

function extractDialogPage(data: unknown): { items: unknown[]; total: number } {
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  if (data && typeof data === "object") {
    const o = data as { items?: unknown; total?: unknown };
    const items = Array.isArray(o.items) ? o.items : [];
    const total = typeof o.total === "number" ? o.total : items.length;
    return { items, total };
  }
  return { items: [], total: 0 };
}

export async function fetchCommsDialogsAllPages(
  listFn: (params: { limit: number; offset: number }) => Promise<unknown>
): Promise<unknown[]> {
  const limit = DIALOGS_PAGE_SIZE;
  let offset = 0;
  const all: unknown[] = [];

  while (true) {
    const page = await listFn({ limit, offset });
    const { items, total } = extractDialogPage(page);
    all.push(...items);
    if (items.length < limit || all.length >= total) break;
    offset += limit;
    if (offset > 10_000) break;
  }

  return all;
}
