import { apiFetch, getImageUrl } from "../client";

export interface OrganizationListItem {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  specialization: string;
  wards_count: number;
  adopted_yearly_count: number;
  needs: string[];
  logo_url: string | null;
}

export type NeedOption = { id: string; label: string };

export interface OrganizationCatalogs {
  cities: string[];
  specializations: string[];
  needs_options: NeedOption[];
}

export interface OrgPublicHero {
  name: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  region: string | null;
  geography_display: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  social_links: { label: string; url: string }[];
  logo_url: string | null;
  cover_url: string | null;
  wards_count: number;
  adopted_yearly_count: number;
  has_chat_contact: boolean;
  admission_rules: string | null;
  adoption_howto: string | null;
}

export interface OrgPublicWardCard {
  id: number;
  name: string;
  species: string;
  age_months: number;
  status: string;
  status_label: string;
  photo_url: string | null;
  is_urgent: boolean;
  open_help_request_id: number | null;
}

export interface OrgPublicAbout {
  is_empty: boolean;
  founded_year: number | null;
  about: string | null;
  gallery_urls: string[];
  inn: string | null;
  ogrn: string | null;
  bank_account: string | null;
}

export interface OrgPublicHelpSection {
  kind: string;
  title: string;
  description: string;
  primary_action: string;
}

export interface OrgPublicUrgentNeed {
  id: number;
  title: string;
  description: string;
  help_type: string;
  is_urgent: boolean;
  animal_id: number | null;
  volunteer_needed: boolean;
}

export interface OrgPublicEvent {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  description: string;
  location_display: string | null;
}

export interface OrgPublicReport {
  id: number;
  title: string;
  published_at: string;
  summary: string | null;
}

export interface OrgPublicArticle {
  id: number;
  title: string;
  category: string;
  read_minutes: number;
}

export interface OrgPublicHomeStory {
  id: number;
  animal_name: string;
  story: string;
  photo_url: string | null;
  adopted_at: string;
}

export interface OrganizationPublicPage {
  hero: OrgPublicHero;
  wards: OrgPublicWardCard[];
  about: OrgPublicAbout;
  help_sections: OrgPublicHelpSection[];
  urgent_help: OrgPublicUrgentNeed[];
  events: OrgPublicEvent[];
  reports: OrgPublicReport[];
  articles: OrgPublicArticle[];
  home_stories: OrgPublicHomeStory[];
}

export type Organization = OrganizationListItem & {
  logo?: string | null;
  description?: string | null;
};

export function organizationLogoPath(org: Pick<OrganizationListItem, "logo_url"> & { logo?: string | null }): string | null {
  return org.logo_url ?? org.logo ?? null;
}

export const organizationsApi = {
  getList: () => apiFetch("/api/v1/organizations") as Promise<{ total: number; items: OrganizationListItem[] }>,
  getCatalogs: () => apiFetch("/api/v1/organizations/catalogs") as Promise<OrganizationCatalogs>,
  getById: (id: number) => apiFetch(`/api/v1/organizations/${id}`) as Promise<OrganizationPublicPage>,
  getImageUrl,
};
