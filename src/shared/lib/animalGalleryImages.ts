import { getImageUrl } from "@/shared/api/client";

type AnimalPhotosSource = {
  primary_photo_url?: string | null;
  photo_urls?: string[] | null;
};

export function resolveAnimalGalleryImages(animal: AnimalPhotosSource): string[] {
  const primaryRaw = animal.primary_photo_url?.trim();
  const primary = primaryRaw ? getImageUrl(primaryRaw) : null;

  const seen = new Set<string>();
  const ordered: string[] = [];

  if (primary) {
    seen.add(primary);
    ordered.push(primary);
  }

  for (const raw of animal.photo_urls ?? []) {
    const url = getImageUrl(raw);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    ordered.push(url);
  }

  return ordered;
}

export function resolveAnimalMainImage(animal: AnimalPhotosSource, placeholder: string): string {
  const gallery = resolveAnimalGalleryImages(animal);
  return gallery[0] ?? placeholder;
}
