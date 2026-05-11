export function formatRub(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "";
  const n = Math.round(Number(amount));
  return `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
}
