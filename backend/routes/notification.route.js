const express = require("express");
const router = express.Router();
const notificationService = require("../services/notification.service");

router.get("/", async (req, res) => {
  try {
    const userKey = String(req.query.userKey || "").trim();
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 50;
    const result = await notificationService.listByUserKey(userKey, { page, pageSize });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put("/:id/read", async (req, res) => {
  try {
    const userKey = String(req.body?.userKey || "").trim();
    const result = await notificationService.markAsRead(req.params.id, userKey);
    if (!result) return res.status(404).json({ success: false, error: "Notification not found" });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

