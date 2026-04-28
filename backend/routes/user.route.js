const express = require("express");
const router = express.Router();
const userService = require("../services/user.service");

function formatDoc(doc) {
  if (!doc) return doc;
  const clone = { ...doc };
  if (clone.password) delete clone.password;
  if (clone._id) clone._id = String(clone._id);
  return clone;
}

/**
 * GET /api/users
 * Lấy tất cả users
 */
router.get("/", async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    
    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/status/online
 * Lấy danh sách users đang online
 */
router.get("/status/online", async (req, res) => {
  try {
    const socketModule = require("../socket");
    const userSessions = socketModule.getUserSessions();
    
    // Convert to object with userId as key and status as value
    const onlineStatus = {};
    userSessions.forEach((session, userId) => {
      onlineStatus[String(userId).trim()] = "online";
    });
    
    console.log(`[Online Status] Returning ${Object.keys(onlineStatus).length} online users:`, Object.keys(onlineStatus));
    
    res.json({
      success: true,
      data: onlineStatus,
    });
  } catch (error) {
    console.error("Error fetching online status:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/users/:id
 * Lấy user theo ID
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/login
 * Login
 */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "username và password là bắt buộc",
      });
    }
    
    const user = await userService.getUserByKeyOrUsername(username);
    
    if (!user || !userService.verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: "Sai username hoặc mật khẩu",
      });
    }
    
    // Không trả về password
    delete user.password;
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users
 * Tạo user mới
 */
router.post("/", async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    // Remove sensitive fields
    const payload = formatDoc(user);

    // Emit socket event to users room
    const io = req.app.get("io");
    if (io) {
      io.to("users").emit("user:created", payload);
    }

    res.status(201).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/users/:id
 * Cập nhật user
 */
router.put("/:id", async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const payload = formatDoc(user);
    const io = req.app.get("io");
    if (io) {
      const eventData = { ...payload };
      if (req.body?.savedHistoryFilters) {
        eventData.isFilterUpdate = true;
      }
      io.to("users").emit("user:updated", eventData);
    }

    res.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/:id/change-password
 * Đổi mật khẩu người dùng
 * Body: { oldPassword, newPassword }
 */
router.post("/:id/change-password", async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Old password and new password are required",
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters",
      });
    }
    
    const user = await userService.changePassword(req.params.id, oldPassword, newPassword);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid old password",
      });
    }
    
    const payload = formatDoc(user);
    res.json({
      success: true,
      data: payload,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/users/:id/logout-all
 * Đăng xuất từ xa: ép logout tất cả phiên đang đăng nhập của user này
 * Lưu `forceLogoutAt` để client refresh cũng bị logout.
 */
router.post("/:id/logout-all", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const existing = await userService.getUserById(id).catch(() => null);
    if (!existing) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const nowIso = new Date().toISOString();
    const updated = await userService.updateUser(id, { forceLogoutAt: nowIso });
    const payload = formatDoc(updated || { ...existing, forceLogoutAt: nowIso });

    const io = req.app.get("io");
    if (io) {
      const targetKey = String(payload?.key || payload?.username || "").trim().toLowerCase();
      if (targetKey) {
        io.to(`user:key:${targetKey}`).emit("user:force-logout", {
          userKey: targetKey,
          userId: String(payload?._id || id),
          forceLogoutAt: nowIso,
          timestamp: Date.now(),
        });
      }
      io.to("users").emit("user:updated", payload);
    }

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error("Error force logout all sessions:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/users/:id
 * Xóa user
 */
router.delete("/:id", async (req, res) => {
  try {
    // Try to fetch user before delete to provide payload
    const existing = await userService.getUserById(req.params.id);
    const success = await userService.deleteUser(req.params.id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const io = req.app.get("io");
    if (io) {
      io.to("users").emit("user:deleted", { _id: req.params.id, username: existing ? existing.username : undefined });
    }

    res.json({
      success: true,
      message: "User deleted",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
