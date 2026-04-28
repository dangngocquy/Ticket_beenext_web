const express = require("express");
const router = express.Router();
const ticketService = require("../services/ticket.service");
const userService = require("../services/user.service");

/**
 * POST /api/tickets
 * Tạo phiếu mới
 */
router.post("/", async (req, res) => {
  try {
    // Lấy thông tin người dùng từ Basic Auth header
    const authHeader = req.headers.authorization;
    let createdBy = "unknown";
    
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [username] = credentials.split(":");
        if (username) {
          const foundUser = await userService.getUserByKeyOrUsername(username);
          createdBy = foundUser?.key || username;
        }
      } catch (e) {
        // Nếu không decode được thì giữ "unknown"
      }
    }
    
    const ticketData = {
      ...req.body,
      createdBy, // Thêm người tạo phiếu
    };
    const ticket = await ticketService.createTicket(ticketData);
    
    // Emit socket event to `tickets` room so only interested clients get updates
    const io = req.app.get("io");
    if (io) {
      io.to("tickets").emit("ticket:new", ticket);
    }
    
    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tickets
 * Lấy danh sách tất cả phiếu
 */
router.get("/", async (req, res) => {
  try {
    const filter = req.query.filter ? JSON.parse(req.query.filter) : {};
    const tickets = await ticketService.getAllTickets(filter);
    
    res.json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/tickets/:id
 * Lấy phiếu theo ID
 */
router.get("/:id", async (req, res) => {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }
    
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/tickets/:id
 * Cập nhật phiếu - chỉ người tạo phiếu mới có quyền chỉnh sửa
 */
router.put("/:id", async (req, res) => {
  try {
    // Lấy thông tin người dùng từ Basic Auth header
    const authHeader = req.headers.authorization;
    let currentUser = "unknown";
    
    if (authHeader && authHeader.startsWith("Basic ")) {
      try {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
        const [username] = credentials.split(":");
        currentUser = username;
      } catch (e) {
        // Nếu không decode được thì giữ "unknown"
      }
    }
    
    // Gọi service với currentUser để kiểm tra quyền
    const ticket = await ticketService.updateTicket(req.params.id, req.body, currentUser);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }
    
    // Emit socket event to `tickets` room so only interested clients get updates
    const io = req.app.get("io");
    if (io) {
      io.to("tickets").emit("ticket:update", ticket);
    }
    
    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    console.error("Error updating ticket:", error);
    
    // Kiểm tra nếu là lỗi quyền
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/tickets/:id
 * Xóa phiếu
 */
router.delete("/:id", async (req, res) => {
  try {
    const success = await ticketService.deleteTicket(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Ticket not found",
      });
    }
    
    // Emit socket event to `tickets` room so only interested clients get updates
    const io = req.app.get("io");
    if (io) {
      io.to("tickets").emit("ticket:delete", { _id: req.params.id });
    }
    
    res.json({
      success: true,
      message: "Ticket deleted",
    });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
