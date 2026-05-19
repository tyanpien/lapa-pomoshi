const CATALOG_SLUG_LABELS: Record<string, string> = {
  cat: "Кошка",
  dog: "Собака",
  other: "Другое",
  male: "Мальчик",
  female: "Девочка",
  unknown: "Не указан",
  looking_for_home: "Ищет дом",
  looking_for_foster: "Ищет передержку",
  on_treatment: "На лечении",
  in_shelter: "В приюте",
  online: "Онлайн",
  offline: "Офлайн",
  care: "Уход",
  first_aid: "Первая помощь",
  adaptation: "Адаптация",
  socialization: "Социализация",
  training: "Воспитание",
  treatment: "Лечение",
  legal: "Юридические вопросы",
  vaccinated: "Привит(а)",
  sterilized: "Стерилизован(а) / кастрирован(а)",
  vaccinated_full: "Комплексно привит(а)",
  dewormed: "Обработан(а) от паразитов",
  calm: "Спокойный(ая)",
  affectionate: "Ласковый(ая)",
  afraid_loud: "Боится громких звуков",
  friendly: "Дружелюбный(ая)",
  active: "Активный(ая)",
  contact: "Контактный(ая)",
  litter_trained: "Приучен к лотку / выгулу",
  child_friendly: "Дружит с детьми",
  animal_friendly: "Дружит с другими животными",
  manual: "Другое",
  open: "Открыта",
  closed: "Закрыта",
  in_progress: "В работе",
};

export function translateCatalogSlug(value: string): string | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return CATALOG_SLUG_LABELS[key] ?? null;
}
