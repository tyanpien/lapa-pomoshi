import { authEndpoints } from "@/shared/api/endpoints/auth";
import { apiClient } from "@/shared/api/client";
import type { AuthMeResponse } from "@/features/auth/api/login";

export type RegisterVolunteerResponse = {
  user: AuthMeResponse;
  email_verification_token?: string;
  phone_verification_token?: string;
};

export type RegisterVolunteerPayload = {
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
};

export const registerVolunteer = async (data: RegisterVolunteerPayload) => {
  const res = await apiClient.post<RegisterVolunteerResponse>(authEndpoints.registerVolunteer, data);
  return res.data;
};
