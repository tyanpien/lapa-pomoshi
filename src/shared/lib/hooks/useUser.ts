import { UserRole } from "@/shared/types/user";
import { clearAuthCookies, setAuthCookies } from "@/shared/lib/auth/cookies";
import { useState, useEffect } from "react";
import { meProfileApi } from "@/shared/api/endpoints/meProfile";
import { meOrganizationApi } from "@/shared/api/endpoints/meOrganization";
import { getImageUrl } from "@/shared/api/client";

const AUTH_CHANGED_EVENT = "auth-changed";
const ME_PROFILE_FETCH_MS = 22_000;

export const USER_EMAIL_STORAGE_KEY = "userEmail";

function readStoredRoleFromBrowser(): UserRole {
  const storedRole = localStorage.getItem("userRole") as UserRole;
  const token = (localStorage.getItem("token") || localStorage.getItem("access_token") || "").trim();
  if (token && storedRole && storedRole !== "guest") return storedRole;
  return "guest";
}

function pickOrgCabinetLogoUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const profile = (data as { profile?: unknown }).profile;
  if (!profile || typeof profile !== "object") return null;
  const logo = (profile as { logo_url?: unknown }).logo_url;
  return typeof logo === "string" && logo.trim() ? logo.trim() : null;
}

function pickOrgCabinetName(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const profile = (data as { profile?: unknown }).profile;
  if (!profile || typeof profile !== "object") return null;
  const name = (profile as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export function syncStoredUserAvatar(url: string | null) {
  if (url) localStorage.setItem("userAvatar", url);
  else localStorage.removeItem("userAvatar");
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function useUser() {
  const [role, setRole] = useState<UserRole>("guest");
  const [isLoading, setIsLoading] = useState(true);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setRole(readStoredRoleFromBrowser());
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedRole = localStorage.getItem("userRole") as UserRole;
        const token =
          typeof window !== "undefined"
            ? (localStorage.getItem("token") || localStorage.getItem("access_token") || "").trim()
            : "";
        const avatar = localStorage.getItem("userAvatar");
        const name = localStorage.getItem("userName");
        const email = localStorage.getItem(USER_EMAIL_STORAGE_KEY);

        if (token && storedRole && storedRole !== "guest") {
          setAuthCookies({ role: storedRole, token });
          setRole(storedRole);
          setUserAvatar(avatar);
          setUserName(name);
          setUserEmail(email?.trim() || null);

          try {
            const profile = await Promise.race([
              meProfileApi.get(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), ME_PROFILE_FETCH_MS)),
            ]);
            if (!profile) {
              return;
            }
            let apiName =
              profile.user.full_name?.trim() || profile.user.email?.trim() || null;
            let apiAvatar: string | null = null;

            if (storedRole === "organization") {
              try {
                const cabinet = await Promise.race([
                  meOrganizationApi.getProfileCabinet(),
                  new Promise<null>((resolve) => setTimeout(() => resolve(null), ME_PROFILE_FETCH_MS)),
                ]);
                const logoRaw = cabinet ? pickOrgCabinetLogoUrl(cabinet) : null;
                apiAvatar = logoRaw ? getImageUrl(logoRaw) : null;
                const orgName = cabinet ? pickOrgCabinetName(cabinet) : null;
                if (orgName) apiName = orgName;
              } catch {
              }
            } else {
              const rawAvatar =
                profile.volunteer_profile?.avatar_url?.trim() ||
                profile.user_profile?.avatar_url?.trim() ||
                "";
              apiAvatar = rawAvatar ? getImageUrl(rawAvatar) : null;
            }

            const tokenStill =
              typeof window !== "undefined"
                ? (localStorage.getItem("token") || localStorage.getItem("access_token") || "").trim()
                : "";
            if (!tokenStill) return;

            if (apiName) {
              localStorage.setItem("userName", apiName);
              setUserName(apiName);
            }
            if (apiAvatar) {
              localStorage.setItem("userAvatar", apiAvatar);
              setUserAvatar(apiAvatar);
            } else if (storedRole !== "volunteer") {
              localStorage.removeItem("userAvatar");
              setUserAvatar(null);
            }
            const apiEmail = profile.user.email?.trim();
            if (apiEmail) {
              localStorage.setItem(USER_EMAIL_STORAGE_KEY, apiEmail);
              setUserEmail(apiEmail);
            }
          } catch {
          }
        } else {
          setRole("guest");
          setUserAvatar(null);
          setUserName(null);
          setUserEmail(null);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setRole("guest");
        setUserAvatar(null);
        setUserName(null);
        setUserEmail(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadUser();

    const handleAuthChanged = () => {
      loadUser();
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        !event.key ||
        ["userRole", "token", "userAvatar", "userName", USER_EMAIL_STORAGE_KEY].includes(event.key)
      ) {
        loadUser();
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setUserRole = (newRole: UserRole, avatar?: string, name?: string) => {
    localStorage.setItem("userRole", newRole);
    const token = localStorage.getItem("token") || localStorage.getItem("access_token");
    if (token && newRole !== "guest") {
      setAuthCookies({ role: newRole, token });
    } else {
      clearAuthCookies();
    }
    if (avatar) localStorage.setItem("userAvatar", avatar);
    if (name) localStorage.setItem("userName", name);
    setRole(newRole);
    if (avatar) setUserAvatar(avatar);
    if (name) setUserName(name);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  const logout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("userAvatar");
    localStorage.removeItem("userName");
    localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
    clearAuthCookies();
    setRole("guest");
    setUserAvatar(null);
    setUserName(null);
    setUserEmail(null);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  return {
    isAuth: role !== "guest",
    role,
    isLoading,
    userAvatar,
    userName,
    userEmail,
    setUserRole,
    logout,
  };
}
