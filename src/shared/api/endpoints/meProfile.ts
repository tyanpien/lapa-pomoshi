import { apiFetch } from "../client";

export type VolunteerTimeRange = { start: string; end: string };

export type VolunteerWeeklySlot = {
  weekday: string;
  ranges: VolunteerTimeRange[];
};

export interface MeUserBrief {
  id: number;
  email: string;
  phone: string | null;
  full_name: string | null;
  role: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
}

export interface MeVolunteerProfileOut {
  about_me: string | null;
  availability: string | null;
  location_city: string | null;
  location_district: string | null;
  travel_radius_km: number | null;
  help_format: string | null;
  has_veterinary_education: boolean;
  weekly_availability: VolunteerWeeklySlot[];
  accepts_night_urgency: boolean;
  travel_area_mode: string | null;
  animal_types: string[];
  experience_level: string | null;
  competency_slugs: string[];
  competency_labels: string[];
  is_available: boolean;
  has_own_transport: boolean;
  can_travel_other_area: boolean;
  latitude: number | null;
  longitude: number | null;
  avatar_url: string | null;
}

export interface MeUserProfileOut {
  avatar_url: string | null;
}

export interface MeProfileResponse {
  user: MeUserBrief;
  user_profile: MeUserProfileOut | null;
  volunteer_profile: MeVolunteerProfileOut | null;
}

export interface UserRoleProfilePatch {
  full_name?: string | null;
}

export interface VolunteerSelfPatch {
  full_name?: string | null;
  about_me?: string | null;
  availability?: string | null;
  location_city?: string | null;
  location_district?: string | null;
  travel_radius_km?: number | null;
  help_format?: string | null;
  has_veterinary_education?: boolean | null;
  weekly_availability?: VolunteerWeeklySlot[] | null;
  accepts_night_urgency?: boolean | null;
  travel_area_mode?: string | null;
  animal_types?: string[] | null;
  competency_slugs?: string[] | null;
  experience_level?: string | null;
  is_available?: boolean | null;
  has_own_transport?: boolean | null;
  can_travel_other_area?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface OrgSelfPatch {
  full_name?: string | null;
}

export interface MeProfilePatchRequest {
  user_fields?: UserRoleProfilePatch | null;
  volunteer?: VolunteerSelfPatch | null;
  organization_contact?: OrgSelfPatch | null;
}

export interface AvatarUploadResponse {
  avatar_url: string;
}

export const meProfileApi = {
  get: () => apiFetch("/api/v1/me/profile") as Promise<MeProfileResponse>,

  patch: (payload: MeProfilePatchRequest) =>
    apiFetch("/api/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }) as Promise<MeProfileResponse>,

  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch("/api/v1/me/profile/avatar", {
      method: "POST",
      body: fd,
    }) as Promise<AvatarUploadResponse>;
  },
};
