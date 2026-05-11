import { apiFetch } from "@/shared/api/client";

export async function verifyEmailWithToken(token: string): Promise<unknown> {
  return apiFetch("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function verifyPhoneWithToken(token: string): Promise<unknown> {
  return apiFetch("/api/v1/auth/verify-phone", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
