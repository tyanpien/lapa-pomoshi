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
