export type EventRegistrationAction = "details" | "signup" | "full" | "registered";

export function getEventActionLabel(
  action: EventRegistrationAction | string | undefined | null,
): string {
  switch (action) {
    case "signup":
      return "Записаться";
    case "full":
      return "Мест нет";
    case "registered":
      return "Вы уже записаны";
    case "details":
    default:
      return "Подробнее";
  }
}

export function isEventActionDisabled(
  action: EventRegistrationAction | string | undefined | null,
): boolean {
  return action === "full" || action === "registered";
}

export function isEventListLinkDisabled(
  action: EventRegistrationAction | string | undefined | null,
): boolean {
  return action === "full";
}

export function formatEventSeatsHint(
  seatsAvailable: number | null | undefined,
  capacity: number | null | undefined,
): string | null {
  if (seatsAvailable == null || capacity == null) return null;
  return `Осталось мест: ${seatsAvailable} из ${capacity}`;
}
