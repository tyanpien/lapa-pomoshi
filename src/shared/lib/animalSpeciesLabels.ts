const SPECIES_SLUG_LABELS: Record<string, string> = {
  cat: "Кошка",
  dog: "Собака",
  other: "Другое",
};

export function formatAnimalSpeciesLabel(
  species: string | null | undefined,
  sex?: string | null
): string {
  const raw = species?.trim();
  if (!raw) return "Не указан";

  const s = raw.toLowerCase();
  const x = (sex || "unknown").toLowerCase();

  if (s === "dog" || s.includes("соб") || s.includes("пес") || s.includes("пёс")) {
    if (x === "male") return "Пес";
    if (x === "female") return "Собака";
    return "Собака";
  }
  if (s === "cat" || s.includes("кот") || s.includes("кош")) {
    if (x === "male") return "Кот";
    if (x === "female") return "Кошка";
    return "Кошка";
  }
  if (s === "other" || s === "другое") return "Другое";

  const mapped = SPECIES_SLUG_LABELS[s];
  if (mapped) {
    if (mapped === "Собака") {
      if (x === "male") return "Пес";
      if (x === "female") return "Собака";
    }
    if (mapped === "Кошка") {
      if (x === "male") return "Кот";
      if (x === "female") return "Кошка";
    }
    return mapped;
  }

  return raw;
}

export function formatUrgentAnimalSpeciesLabel(species: string | null | undefined): string | null {
  const label = formatAnimalSpeciesLabel(species);
  return label === "Не указан" ? null : label;
}
