import type { Animal } from "@/shared/api/endpoints/animals";
import { fetchOrganizationCabinetApiPayload, mergeApiFirstById } from "@/shared/lib/organizationPublicCabinet";

export { mapOrgPublicWardToAnimal } from "@/shared/lib/organizationPublicCabinet";

export async function fetchOrganizationApiAnimalsByNameHints(
  nameHints: readonly string[]
): Promise<{ apiAnimals: Animal[]; apiAnimalIds: Set<number> }> {
  const p = await fetchOrganizationCabinetApiPayload(nameHints);
  return { apiAnimals: p.apiAnimals, apiAnimalIds: p.apiAnimalIds };
}

export function mergeApiAndLocalAnimals(api: Animal[], local: Animal[]): Animal[] {
  return mergeApiFirstById(api, local);
}
