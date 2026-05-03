import { apiFetch, getImageUrl } from "../client";

export type HelpAnimalApiTab = "all" | "adopt" | "feed" | "heal" | "other";

export interface HelpAnimalMonetary {
  request_id: number;
  help_bucket: string;
  line: string;
  amount_rub: number | null;
}

export interface HelpAnimalItem {
  animal_id: number;
  name: string;
  species_tag: string;
  age_tag: string;
  status_chip: string;
  organization_name: string;
  location_city: string;
  is_urgent: boolean;
  monetary: HelpAnimalMonetary[];
  adopt_ready: boolean;
  primary_photo_url: string;
}

export interface HelpAnimalResponse {
  tab: string;
  total: number;
  items: HelpAnimalItem[];
}

export const helpApi = {
  getAnimalHelp: (tab: HelpAnimalApiTab) => {
    const q = new URLSearchParams({ tab });
    return apiFetch(`/api/v1/help/animals?${q.toString()}`) as Promise<HelpAnimalResponse>;
  },
  getImageUrl,
};
