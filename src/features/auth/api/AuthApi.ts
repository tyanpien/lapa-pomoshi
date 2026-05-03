import { apiFetch } from "@/shared/api/client";

export const authApi = {
  registerUser: (data: {
    contact: string;
    full_name: string;
    password: string;
    password_confirmation: string;
    consent_personal_data: boolean;
  }) =>
    apiFetch("/api/v1/auth/register/user", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  registerVolunteer: (data: {
    contact: string;
    full_name: string;
    password: string;
    password_confirmation: string;
    consent_personal_data: boolean;
    location_city: string;
    has_own_transport: boolean;
    can_travel_other_area: boolean;
    availability: string;
    travel_radius_km: number;
  }) =>
    apiFetch("/api/v1/auth/register/volunteer", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  registerOrganization: (data: {
    contact: string;
    full_name: string;
    password: string;
    password_confirmation: string;
    consent_personal_data: boolean;
    display_name: string;
    organization_type: string;
    city: string;
    request_verification: boolean;
    legal_name: string;
    work_territory: string;
    description: string;
    admission_rules: string;
    contacts: Array<{
      contact_type: string;
      value: string;
      note: string;
    }>;
    verification: {
      documents_url: string;
      comment: string;
    };
  }) =>
    apiFetch("/api/v1/auth/register/organization", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { credential: string; password: string }) =>
    apiFetch("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
