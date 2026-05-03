import { UserRole } from "@/shared/types/user";
import { clearAuthCookies, setAuthCookies } from "@/shared/lib/auth/cookies";
import { useState, useEffect } from "react";

const AUTH_CHANGED_EVENT = "auth-changed";

export function useUser() {
  const [role, setRole] = useState<UserRole>("guest");
  const [isLoading, setIsLoading] = useState(true);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = () => {
      try {
        const storedRole = localStorage.getItem("userRole") as UserRole;
        const token = localStorage.getItem("token");
        const avatar = localStorage.getItem("userAvatar");
        const name = localStorage.getItem("userName");

        if (token && storedRole && storedRole !== "guest") {
          setAuthCookies({ role: storedRole, token });
          setRole(storedRole);
          setUserAvatar(avatar);
          setUserName(name);
        } else {
          setRole("guest");
          setUserAvatar(null);
          setUserName(null);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setRole("guest");
        setUserAvatar(null);
        setUserName(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();

    const handleAuthChanged = () => {
      loadUser();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || ["userRole", "token", "userAvatar", "userName"].includes(event.key)) {
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
    clearAuthCookies();
    setRole("guest");
    setUserAvatar(null);
    setUserName(null);
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  };

  return {
    isAuth: role !== "guest",
    role,
    isLoading,
    userAvatar,
    userName,
    setUserRole,
    logout,
  };
}
