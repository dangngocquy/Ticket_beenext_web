/**
 * Socket.IO Client Helper for Electron
 * Handles real-time synchronization with backend
 */

const io = require("socket.io-client");

class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {};
  }

  /**
   * Kết nối tới Socket.IO server
   */
  connect(url = process.env.BACKEND_URL) {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(url, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
          this.isConnected = true;
          console.log("✓ Socket.IO connected");
          
          // Emit listen event để server biết client muốn lắng nghe
          this.socket.emit("listen:tickets");
          this.socket.emit("listen:history");
          this.socket.emit("listen:customers");
          this.socket.emit("listen:users");
          
          resolve();
        });

        this.socket.on("disconnect", () => {
          this.isConnected = false;
          console.log("✗ Socket.IO disconnected");
        });

        this.socket.on("connect_error", (error) => {
          console.error("Socket.IO connection error:", error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Nghe sự kiện từ server
   */
  on(event, callback) {
    if (!this.socket) {
      console.warn("Socket not connected");
      return;
    }

    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    this.socket.on(event, callback);
  }

  /**
   * Tắt lắng nghe sự kiện
   */
  off(event, callback) {
    if (!this.socket) return;

    this.socket.off(event, callback);

    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Kiểm tra connection status
   */
  isReady() {
    return this.isConnected && this.socket && this.socket.connected;
  }
}

// Export singleton instance
module.exports = new SocketClient();
