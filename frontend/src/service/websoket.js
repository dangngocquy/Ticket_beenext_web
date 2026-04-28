/* eslint-disable react-hooks/rules-of-hooks */
import { io } from "socket.io-client";
import { useApiUrl } from "./Api";
let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket() {
  if (socket) return socket;
  const wsBase = useApiUrl();
  socket = io(wsBase, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    // subscribe to rooms used by backend/socket.js
    socket.emit("listen:history");
    socket.emit("listen:customers");
    socket.emit("listen:users");
    socket.emit("listen:customer-accounts");
    socket.emit("listen:tickets");
  });

  return socket;
}

export function disconnectSocket() {
  try {
    socket?.disconnect?.();
  } finally {
    socket = null;
  }
}

