import axios from "axios";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const PROXY_BASE_URL = "";

const toRequestUrl = (endpoint: string): string => {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }

  return `${PROXY_BASE_URL}${endpoint}`;
};

export const getImageUrl = (photoUrl: string | null | undefined): string => {
  if (!photoUrl) return "/placeholder.jpg";
  if (
    photoUrl.startsWith("http://") ||
    photoUrl.startsWith("https://") ||
    photoUrl.startsWith("data:") ||
    photoUrl.startsWith("blob:")
  ) {
    return photoUrl;
  }
  return `${API_BASE_URL}${photoUrl}`;
};

export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const response = await fetch(toRequestUrl(endpoint), options);

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
};

export const apiClient = axios.create({
  baseURL: PROXY_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
