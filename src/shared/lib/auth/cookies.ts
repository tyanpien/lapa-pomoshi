export type AuthRole = "user" | "volunteer" | "organization";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const COOKIE_BASE = `Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;

export const setAuthCookies = (params: { role: AuthRole; token: string }) => {
  if (typeof document === "undefined") return;
  document.cookie = `auth_role=${encodeURIComponent(params.role)}; ${COOKIE_BASE}`;
  document.cookie = `auth_token=${encodeURIComponent(params.token)}; ${COOKIE_BASE}`;
};

export const clearAuthCookies = () => {
  if (typeof document === "undefined") return;
  document.cookie = "auth_role=; Path=/; Max-Age=0; SameSite=Lax";
  document.cookie = "auth_token=; Path=/; Max-Age=0; SameSite=Lax";
};
