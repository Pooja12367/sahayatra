import { io } from "socket.io-client";

export const socket = io(
  process.env.NEXT_PUBLIC_SOCKET_URL ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ??
    "http://localhost:5002",
  {
    withCredentials: true,
    autoConnect: false,
    // Aggressively try to reconnect — important for page navigations
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  },
);

const socketConsumers = new Set<symbol>();

export function acquireSocketConnection() {
  const token = Symbol("socket-consumer");

  socketConsumers.add(token);

  if (!socket.connected) {
    socket.connect();
  }

  return token;
}

export function releaseSocketConnection(token: symbol) {
  socketConsumers.delete(token);

  // Do NOT disconnect immediately — the driver may be navigating between
  // pages and the socket should survive the brief gap.
  // The connection is only truly dropped when the tab closes (see below).
}

// Only disconnect when the browser tab is actually being closed / refreshed.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (socket.connected) {
      socket.disconnect();
    }
  });
}
