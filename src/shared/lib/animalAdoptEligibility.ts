export function isAnimalAdoptable(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "looking_for_home" || s === "looking_for_foster";
}

export function adoptActionLabel(status: string): string {
  return status.trim().toLowerCase() === "looking_for_home"
    ? "Забрать домой"
    : "Забрать на передержку";
}
