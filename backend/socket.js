const socketIO = require("socket.io");

// Track printing tickets to avoid duplicates
const printingTickets = new Map();

// Track user online status with multiple sessions support
// Structure: { userId: { sessions: [{ socketId, username, key, loginTime }, ...] } }
const userSessions = new Map();

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`✓ Client connected: ${socket.id}`);
    let currentUserId = null;
    let wasUserOnline = false;

    // User login - track user online status with multiple sessions support
    socket.on("user:login", (data) => {
      const userId = data?.userId || data?.id;
      const username = data?.username;
      const key = data?.key;
      
      console.log(`[Socket] user:login event: userId="${userId}", username="${username}", key="${key}"`);
      
      if (userId) {
        currentUserId = String(userId).trim();
        wasUserOnline = false;
        console.log(`[Socket] Normalized userId: "${currentUserId}"`);
        
        // Check if user already has sessions
        const existingSessions = userSessions.get(currentUserId);
        wasUserOnline = existingSessions && existingSessions.sessions && existingSessions.sessions.length > 0;
        
        if (!existingSessions) {
          userSessions.set(currentUserId, {
            sessions: [],
            username,
            key,
          });
        }
        
        // Add new session
        const sessions = userSessions.get(currentUserId).sessions || [];
        sessions.push({
          socketId: socket.id,
          loginTime: Date.now(),
        });
        userSessions.get(currentUserId).sessions = sessions;
        
        console.log(`[User] ${username || currentUserId} logged in from ${socket.id} (total sessions: ${sessions.length})`);
        
        // Broadcast user online only if this is their first session
        if (!wasUserOnline) {
          io.to("users").emit("user:online", {
            userId: currentUserId,
            username,
            key,
            timestamp: Date.now(),
          });
          console.log(`[Online] ${username || currentUserId} is now ONLINE`);
        }
      }
      const normalizedKey = String(key || "").trim().toLowerCase();
      const normalizedUsername = String(username || "").trim().toLowerCase();
      if (normalizedKey) {
        socket.join(`user:key:${normalizedKey}`);
      }
      if (normalizedUsername) {
        socket.join(`user:key:${normalizedUsername}`);
      }
      socket.join("authenticated");
    });

    // Khi client lắng nghe ticket updates
    socket.on("listen:tickets", () => {
      console.log(`Client ${socket.id} listening to ticket updates`);
      socket.join("tickets");
    });

    // Khi client lắng nghe history updates
    socket.on("listen:history", () => {
      console.log(`Client ${socket.id} listening to history updates`);
      socket.join("history");
    });

    // Khi client lắng nghe customer updates
    socket.on("listen:customers", () => {
      console.log(`Client ${socket.id} listening to customer updates`);
      socket.join("customers");
    });

    // Khi client lắng nghe user/account updates
    socket.on("listen:users", () => {
      console.log(`Client ${socket.id} listening to user updates`);
      socket.join("users");
    });

    // Khi client in phiếu
    socket.on("ticket:printing", (data) => {
      const { ticketId, soPhieu, nguoiInPhieu, timestamp } = data || {};

      // Build a unique internal key; prefer ticketId but fall back to soPhieu
      const key = ticketId || soPhieu || `${socket.id}:${Date.now()}:${Math.random()}`;

      // If an entry already exists with the same ticketId or soPhieu, avoid duplication.
      const exists = Array.from(printingTickets.values()).some(
        (v) => (ticketId && v.ticketId && String(v.ticketId) === String(ticketId)) || (soPhieu && v.soPhieu === soPhieu)
      );

      if (!exists) {
        printingTickets.set(key, {
          ticketId: ticketId || null,
          soPhieu: soPhieu || null,
          clientId: socket.id,
          nguoiInPhieu: nguoiInPhieu || null,
          startTime: timestamp || Date.now(),
        });

        console.log(`[Printing] Ticket ${soPhieu || key} started by ${socket.id}`);

        // Broadcast to clients listening to tickets room
        io.to("tickets").emit("ticket:printing-status", {
          ticketId: ticketId || null,
          soPhieu: soPhieu || null,
          status: "printing",
          nguoiInPhieu: nguoiInPhieu || null,
          timestamp: timestamp || Date.now(),
        });
      }
    });

    // Khi in phiếu xong (thành công)
    socket.on("ticket:printed", (data) => {
      const { ticketId, soPhieu, nguoiInPhieu } = data || {};

      // Find the internal key matching by ticketId or soPhieu
      let foundKey = null;
      for (let [k, v] of printingTickets.entries()) {
        if (ticketId && v.ticketId && String(v.ticketId) === String(ticketId)) {
          foundKey = k;
          break;
        }
        if (soPhieu && v.soPhieu === soPhieu) {
          foundKey = k;
          break;
        }
      }

      if (foundKey) {
        printingTickets.delete(foundKey);
        console.log(`[Success] Ticket ${soPhieu || foundKey} printed by ${socket.id}`);

        io.to("tickets").emit("ticket:print-success", {
          ticketId: ticketId || null,
          soPhieu: soPhieu || null,
          nguoiInPhieu: nguoiInPhieu || null,
          timestamp: Date.now(),
        });
      }
    });

    // Khi hủy phiếu (không phải lỗi in)
    socket.on("ticket:cancelled", (data) => {
      const { ticketId, soPhieu, reason = "Người dùng hủy" } = data || {};

      // Find matching key and delete
      for (let [k, v] of printingTickets.entries()) {
        if ((ticketId && v.ticketId && String(v.ticketId) === String(ticketId)) || (soPhieu && v.soPhieu === soPhieu)) {
          printingTickets.delete(k);
        }
      }

      console.log(`[Cancelled] Ticket ${soPhieu || ticketId} cancelled: ${reason}`);

      io.to("tickets").emit("ticket:cancelled", {
        ticketId: ticketId || null,
        soPhieu: soPhieu || null,
        reason,
        timestamp: Date.now(),
      });
    });

    // Khi in phiếu thất bại (lỗi thực sự)
    socket.on("ticket:print-error", (data) => {
      const { ticketId, soPhieu, error, nguoiInPhieu } = data || {};

      for (let [k, v] of printingTickets.entries()) {
        if ((ticketId && v.ticketId && String(v.ticketId) === String(ticketId)) || (soPhieu && v.soPhieu === soPhieu)) {
          printingTickets.delete(k);
        }
      }

      console.error(`[Error] Ticket ${soPhieu || ticketId} print failed: ${error}`);

      io.to("tickets").emit("ticket:print-failed", {
        ticketId: ticketId || null,
        soPhieu: soPhieu || null,
        error,
        nguoiInPhieu: nguoiInPhieu || null,
        timestamp: Date.now(),
      });
    });

    // Sync tất cả phiếu đang in
    socket.on("request:printing-tickets", () => {
      const tickets = Array.from(printingTickets.entries()).map(([k, info]) => ({
        key: k,
        ticketId: info.ticketId,
        soPhieu: info.soPhieu,
        status: "printing",
        nguoiInPhieu: info.nguoiInPhieu,
        startTime: info.startTime,
      }));

      socket.emit("printing-tickets-list", tickets);
    });

    socket.on("disconnect", () => {
      console.log(`✗ Client disconnected: ${socket.id}`);

      // Remove user session and only set offline if all sessions are gone
      if (currentUserId) {
        const userSession = userSessions.get(currentUserId);
        if (userSession && userSession.sessions) {
          // Remove this socket from sessions
          userSession.sessions = userSession.sessions.filter(s => s.socketId !== socket.id);
          console.log(`[User] Removed session ${socket.id} for ${currentUserId} (remaining sessions: ${userSession.sessions.length})`);
          
          // Only broadcast offline if no sessions left
          if (userSession.sessions.length === 0) {
            userSessions.delete(currentUserId);
            console.log(`[Offline] ${userSession.username || currentUserId} is now OFFLINE`);
            
            io.to("users").emit("user:offline", {
              userId: currentUserId,
              username: userSession.username,
              key: userSession.key,
              timestamp: Date.now(),
            });
          }
        }
      }

      // Remove printing tickets
      for (let [k, info] of printingTickets.entries()) {
        if (info.clientId === socket.id) {
          printingTickets.delete(k);
          console.log(`[Cleanup] Removed orphaned printing ticket: ${info.soPhieu || k}`);

          io.to("tickets").emit("ticket:cancelled", {
            ticketId: info.ticketId || null,
            soPhieu: info.soPhieu || null,
            reason: "Client disconnected",
            timestamp: Date.now(),
          });
        }
      }
    });
  });

  return io;
}

module.exports = {
  initializeSocket,
  getUserSessions: () => userSessions,
};
