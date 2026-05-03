import { authEndpoints } from "@/shared/api/endpoints/auth";
import { apiClient } from "@/shared/api/client";
import type { AuthMeResponse } from "@/features/auth/api/login";

export type RegisterUserResponse = {
  user: AuthMeResponse;
  email_verification_token?: string;
  phone_verification_token?: string;
};

export type RegisterUserPayload = {
  contact: string;
  full_name: string;
  password: string;
  password_confirmation: string;
  consent_personal_data: boolean;
};

export const registerUser = async (data: RegisterUserPayload) => {
  const res = await apiClient.post<RegisterUserResponse>(authEndpoints.registerUser, data);
  return res.data;
};
