import axios from "axios";

function normalizeApiOrigin(url: string | undefined): string {
  const trimmed = (url ?? "").trim().replace(/\/+$/, "");
  return trimmed || "http://127.0.0.1:8000";
}

export const API_BASE_URL = normalizeApiOrigin(process.env.NEXT_PUBLIC_API_URL);

const SERVER_FETCH_TIMEOUT_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_SERVER_FETCH_TIMEOUT_MS;
  const n = raw ? Number(raw) : 8_000;
  return Number.isFinite(n) && n > 0 ? n : 8_000;
})();

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([a, b]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (a.aborted || b.aborted) {
    abort();
    return controller.signal;
  }
  a.addEventListener("abort", abort, { once: true });
  b.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (const raw of cookies) {
    const [k, ...rest] = raw.trim().split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("=") ?? "").trim();
    }
  }
  return "";
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = (localStorage.getItem("refresh_token") || "").trim();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshPath = "/api/v1/auth/refresh";
        const refreshUrl = typeof window !== "undefined" ? refreshPath : `${API_BASE_URL}${refreshPath}`;
        const res = await fetch(refreshUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { access_token?: unknown; refresh_token?: unknown; token_type?: unknown };
        const nextAccess = typeof data?.access_token === "string" ? data.access_token : "";
        const nextRefresh = typeof data?.refresh_token === "string" ? data.refresh_token : "";
        if (!nextAccess.trim()) return null;

        localStorage.setItem("access_token", nextAccess);
        localStorage.setItem("token", nextAccess);
        if (nextRefresh.trim()) {
          localStorage.setItem("refresh_token", nextRefresh);
        }

        try {
          const maxAge = 60 * 60 * 24 * 7;
          document.cookie = `auth_token=${encodeURIComponent(nextAccess)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
        } catch {
        }

        return nextAccess;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

const toRequestUrl = (endpoint: string): string => {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  if (endpoint.startsWith("/api/")) {
    if (typeof window !== "undefined") {
      return endpoint;
    }
    return `${API_BASE_URL}${endpoint}`;
  }
  return endpoint;
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

export const ANIMAL_PLACEHOLDER_SRC = "/placeholder.jpg";

const ANIMAL_AVATAR_FALLBACK = ANIMAL_PLACEHOLDER_SRC;

export function onAnimalImageError(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = ANIMAL_PLACEHOLDER_SRC;
}

export function resolveAnimalAvatarSrc(
  ...sources: (string | null | undefined)[]
): string {
  for (const raw of sources) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    return getImageUrl(trimmed);
  }
  return ANIMAL_AVATAR_FALLBACK;
}

export const apiFetch = async (endpoint: string, options?: RequestInit) => {
  const token = (() => {
    if (typeof window === "undefined") return "";
    const fromStorage = (localStorage.getItem("token") || localStorage.getItem("access_token") || "").trim();
    if (fromStorage) return fromStorage;
    return readCookie("auth_token");
  })();

  const headers = new Headers(options?.headers ?? {});
  const method = (options?.method ?? "GET").toUpperCase();
  const hasBody = options?.body !== undefined && options?.body !== null;
  const isFormData = typeof FormData !== "undefined" && options?.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = toRequestUrl(endpoint);
  const isServer = typeof window === "undefined";
  let signal = options?.signal;
  if (isServer && SERVER_FETCH_TIMEOUT_MS > 0) {
    const timeoutSignal = AbortSignal.timeout(SERVER_FETCH_TIMEOUT_MS);
    signal = signal ? mergeAbortSignals(signal, timeoutSignal) : timeoutSignal;
  }

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`API timeout (${SERVER_FETCH_TIMEOUT_MS}ms): ${endpoint}`);
    }
    throw error;
  }

  if (response.status === 401) {
    const nextToken = await refreshAccessToken();
    if (nextToken && (!token || nextToken !== token)) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${nextToken}`);
      const retry = await fetch(url, { ...options, headers: retryHeaders });
      if (!retry.ok) {
        throw new Error(`API Error: ${retry.status}`);
      }
      if (retry.status === 204 || method === "HEAD") {
        return null;
      }
      const contentType = retry.headers.get("content-type") || "";
      if (!contentType) {
        const text = await retry.text();
        return text ? text : null;
      }
      if (contentType.includes("application/json")) {
        return retry.json();
      }
      return retry.text();
    }
  }

  if (!response.ok) {
    let detail = `API Error: ${response.status}`;
    try {
      const ct = response.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = (await response.json()) as { detail?: unknown };
        if (data?.detail !== undefined) {
          detail =
            typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail, null, 0);
        }
      }
    } catch {
    }
    throw new Error(detail);
  }

  if (response.status === 204 || method === "HEAD") {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType) {
    const text = await response.text();
    return text ? text : null;
  }

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

export const apiClient = axios.create({
  baseURL: typeof window !== "undefined" ? "" : API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
