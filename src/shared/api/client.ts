export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const getImageUrl = (photoUrl: string | null | undefined): string => {
  if (!photoUrl) return "/placeholder.jpg";
  if (photoUrl.startsWith('http')) return photoUrl;
  if (photoUrl.startsWith('/media')) return `${API_BASE_URL}${photoUrl}`;
  return `${API_BASE_URL}${photoUrl}`;
};

export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(`${endpoint}`, options);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
};
