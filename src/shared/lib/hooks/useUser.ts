import { UserRole } from "@/shared/types/user";
import { useState, useEffect } from "react";

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

        if (token && storedRole) {
          setRole(storedRole);
          setUserAvatar(avatar);
          setUserName(name);
        } else {
          setRole("guest");
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setRole("guest");
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const setUserRole = (newRole: UserRole, avatar?: string, name?: string) => {
    localStorage.setItem("userRole", newRole);
    if (avatar) localStorage.setItem("userAvatar", avatar);
    if (name) localStorage.setItem("userName", name);
    setRole(newRole);
    if (avatar) setUserAvatar(avatar);
    if (name) setUserName(name);
  };

  const logout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("token");
    localStorage.removeItem("userAvatar");
    localStorage.removeItem("userName");
    setRole("guest");
    setUserAvatar(null);
    setUserName(null);
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
