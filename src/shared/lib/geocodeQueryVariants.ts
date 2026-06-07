export function buildGeocodeQueryVariants(raw: string): string[] {
  const base = raw.trim();
  if (!base) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const push = (value: string) => {
    const t = value.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  push(base);

  const hasRussia = /россия|russia/i.test(base);
  if (!hasRussia) {
    push(`${base}, Россия`);
    if (!/^город\s/i.test(base)) {
      push(`город ${base}, Россия`);
    }
  }

  const cityOnly = base.replace(/,.*$/, "").trim();
  const regionHints: Record<string, string> = {
    киров: "Киров, Кировская область, Россия",
    "санкт-петербург": "Санкт-Петербург, Россия",
    спб: "Санкт-Петербург, Россия",
    "нижний новгород": "Нижний Новгород, Нижегородская область, Россия",
  };
  const hint = regionHints[cityOnly.toLowerCase()];
  if (hint) push(hint);

  return out;
}

export function withRussiaSuffix(query: string): string {
  const q = query.trim();
  if (!q) return q;
  if (/россия|russia/i.test(q)) return q;
  return `${q}, Россия`;
}
