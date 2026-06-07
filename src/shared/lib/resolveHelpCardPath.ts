export function resolveHelpCardPath(card: {
  animalId?: number | null;
  primaryHelpRequestId?: number | null;
}): string {
  const animalId = card.animalId;
  if (animalId != null && animalId > 0) {
    return `/catalog/animals/${animalId}?help=1`;
  }
  const requestId = card.primaryHelpRequestId;
  if (requestId != null && Number.isFinite(requestId)) {
    return `/urgent/${requestId}?help=1`;
  }
  return "/help";
}
