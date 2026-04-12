import { UserRole } from "@/shared/types/user";
import { useState } from "react";

export function useUser() {
  const [role] = useState<UserRole>("guest");
  // guest | user | volunteer | organization

  return {
    isAuth: role !== "guest",
    role,
  };
}
