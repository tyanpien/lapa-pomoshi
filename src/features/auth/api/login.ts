import { authEndpoints } from "@/shared/api/endpoints/auth";
import { apiClient } from "@/shared/api/client";
import type { AuthRole } from "@/shared/lib/auth/cookies";

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
};

export type AuthMeResponse = {
  id: number;
  email?: string | null;
  phone?: string | null;
  full_name: string;
  role: string;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  personal_data_consent_at?: string | null;
};

export const mapBackendRoleToApp = (role: string): AuthRole => {
  const r = role.toLowerCase();
  if (r === "organization" || r === "org") return "organization";
  if (r === "volunteer") return "volunteer";
  return "user";
};

export const login = async (data: { credential: string; password: string }) => {
  const res = await apiClient.post<LoginResponse>(authEndpoints.login, data);

  localStorage.setItem("access_token", res.data.access_token);
  localStorage.setItem("refresh_token", res.data.refresh_token);
  localStorage.setItem("token", res.data.access_token);

  return res.data;
};

export const fetchAuthMe = async (accessToken: string): Promise<AuthMeResponse | null> => {
  if (!accessToken) return null;
  try {
    const res = await apiClient.get<AuthMeResponse>("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.data;
  } catch {
    return null;
  }
};

export const fetchProfileName = async (accessToken: string): Promise<string> => {
  if (!accessToken) return "";

  const me = await fetchAuthMe(accessToken);
  if (me?.full_name?.trim()) return me.full_name.trim();

  const legacyEndpoints = ["/api/v1/users/me", "/api/v1/me/profile", "/api/v1/me/volunteers", "/api/v1/me/organizations"];

  for (const endpoint of legacyEndpoints) {
    try {
      const res = await apiClient.get<{ full_name?: string; name?: string }>(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const d = res.data;
      if (typeof d?.full_name === "string" && d.full_name.trim()) return d.full_name.trim();
      if (typeof d?.name === "string" && d.name.trim()) return d.name.trim();
    } catch {
    }
  }

  return "";
};
