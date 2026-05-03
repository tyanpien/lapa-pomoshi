import { authEndpoints } from "@/shared/api/endpoints/auth";
import { apiClient } from "@/shared/api/client";
import type { AuthMeResponse } from "@/features/auth/api/login";

export type RegisterOrganizationResponse = {
  user: AuthMeResponse;
  email_verification_token?: string;
  phone_verification_token?: string;
};

export type RegisterOrganizationPayload = {
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
};

export const registerOrganization = async (data: RegisterOrganizationPayload) => {
  const res = await apiClient.post<RegisterOrganizationResponse>(authEndpoints.registerOrganization, data);
  return res.data;
};
