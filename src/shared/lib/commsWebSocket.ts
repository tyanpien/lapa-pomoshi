import { API_BASE_URL } from "@/shared/api/client";
import type { CommsMessageNewEvent } from "@/shared/lib/organizationOrgDialogs";

const WS_PING_INTERVAL_MS = 25_000;
const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 30_000;

export type CommsWsServerEvent =
  | { type: "connected"; user_id: number }
  | { type: "pong" }
  | CommsMessageNewEvent;

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

export function readAccessToken(): string {
  if (typeof window === "undefined") return "";
  const fromStorage = (localStorage.getItem("token") || localStorage.getItem("access_token") || "").trim();
  if (fromStorage) return fromStorage;
  return readCookie("auth_token");
}

function buildDirectBackendWsUrl(token: string): string {
  const wsOrigin = API_BASE_URL.replace(/^http/i, (match) =>
    match.toLowerCase() === "https" ? "wss" : "ws"
  );
  const url = new URL("/api/v1/ws/communications", wsOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildCommunicationsWsUrl(token: string): string {
  const explicitWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicitWs) {
    const url = new URL(explicitWs);
    url.searchParams.set("token", token);
    return url.toString();
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`${protocol}//${window.location.host}/api/v1/ws/communications`);
    url.searchParams.set("token", token);
    return url.toString();
  }

  return buildDirectBackendWsUrl(token);
}

export type CommunicationsWebSocketOptions = {
  enabled: boolean;
  onMessageNew: (event: CommsMessageNewEvent) => void;
  onConnected?: () => void;
};

export function connectCommunicationsWebSocket(options: CommunicationsWebSocketOptions): () => void {
  const { enabled, onMessageNew, onConnected } = options;
  if (!enabled || typeof window === "undefined") {
    return () => {};
  }

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  let attempt = 0;

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    attempt += 1;
    const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** (attempt - 1), WS_RECONNECT_MAX_MS);
    reconnectTimer = setTimeout(() => connect(), delay);
  };

  const handlePayload = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const event = data as CommsWsServerEvent;
    if (event.type === "connected") {
      onConnected?.();
      return;
    }
    if (event.type === "message.new") {
      onMessageNew(event);
    }
  };

  const connect = () => {
    if (disposed) return;
    const token = readAccessToken();
    if (!token) return;

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }

    ws = new WebSocket(buildCommunicationsWsUrl(token));

    ws.onopen = () => {
      attempt = 0;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, WS_PING_INTERVAL_MS);
    };

    ws.onmessage = (ev) => {
      try {
        handlePayload(JSON.parse(String(ev.data)));
      } catch {
      }
    };

    ws.onclose = () => {
      clearTimers();
      ws = null;
      if (!disposed) scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  connect();

  const handleAuthChanged = () => {
    if (disposed) return;
    attempt = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    connect();
  };

  window.addEventListener("auth-changed", handleAuthChanged);

  return () => {
    disposed = true;
    window.removeEventListener("auth-changed", handleAuthChanged);
    clearTimers();
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.close();
      ws = null;
    }
  };
}
