const SPECIES_SLUG_LABELS: Record<string, string> = {
  cat: "Кошка",
  dog: "Собака",
};

export function formatUrgentAnimalSpeciesLabel(species: string | null | undefined): string | null {
  const raw = species?.trim();
  if (!raw) return null;
  const mapped = SPECIES_SLUG_LABELS[raw.toLowerCase()];
  if (mapped) return mapped;
  return raw;
}
