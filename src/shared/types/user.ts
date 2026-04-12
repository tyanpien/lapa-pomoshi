export type UserRole = "guest" | "user" | "volunteer" | "organization";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  city?: string;
  avatar?: string;
  createdAt: string;
}

export interface VolunteerProfile extends User {
  role: "volunteer";
  canTravel: boolean;
  helpDirections: string[];
  hasTransport: boolean;
}

export interface OrganizationProfile extends User {
  role: "organization";
  organizationName: string;
  organizationType: string;
  isVerified: boolean;
}
