const pluralRu = (n: number, one: string, few: string, many: string): string => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

export function formatAgeMonthsRu(months: number | null | undefined): string {
  if (months == null || Number.isNaN(months)) return "Возраст не указан";

  const total = Math.max(0, Math.floor(months));
  if (total === 0) return "0 месяцев";

  if (total < 12) {
    return `${total} ${pluralRu(total, "месяц", "месяца", "месяцев")}`;
  }

  const years = Math.floor(total / 12);
  const remainingMonths = total % 12;
  const yearLabel = pluralRu(years, "год", "года", "лет");

  if (remainingMonths === 0) {
    return `${years} ${yearLabel}`;
  }

  const monthLabel = pluralRu(remainingMonths, "месяц", "месяца", "месяцев");
  return `${years} ${yearLabel} ${remainingMonths} ${monthLabel}`;
}
