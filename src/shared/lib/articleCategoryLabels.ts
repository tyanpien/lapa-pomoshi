const ARTICLE_CATEGORY_LABELS: Record<string, string> = {
  care: "Уход",
  first_aid: "Первая помощь",
  adaptation: "Адаптация",
  socialization: "Социализация",
  training: "Воспитание",
  treatment: "Лечение",
  legal: "Юридические вопросы",
  education: "Обучение",
  other: "Другое",
};

export function getArticleCategoryLabel(category: string): string {
  const normalized = category.trim().toLowerCase();
  return ARTICLE_CATEGORY_LABELS[normalized] ?? category;
}

export function articleCategoriesForSelect<T extends { id: string; label: string }>(
  categories: readonly T[]
): T[] {
  const filtered = categories.filter(
    (c) => c.id.trim().toLowerCase() !== "all"
  );

  const hasOther = filtered.some(
    (c) => c.id.trim().toLowerCase() === "other"
  );

  if (!hasOther) {
    filtered.push({
      id: "other",
      label: "Другое",
    } as T);
  }

  return filtered;
}