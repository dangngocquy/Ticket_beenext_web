const express = require("express");
const router = express.Router();
const signatureService = require("../services/signature.service");

/**
 * POST /api/signatures/upload
 * Upload or update user signature
 */
router.post("/upload", async (req, res) => {
  try {
    const { userId, signatureDataUrl } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }
    
    const signature = await signatureService.saveSignature(userId, signatureDataUrl);
    
    // Emit socket event for real-time update
    const io = req.app.get("io");
    if (io) {
      io.to("signatures").emit("signature:update", { userId, signature });
    }
    
    res.json({
      success: true,
      data: signature,
    });
  } catch (error) {
    console.error("Error uploading signature:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/signatures/current
 * Get current logged-in user's signature
 */
router.get("/current", async (req, res) => {
  try {
    // Get user ID from auth header or session
    const userId = req.query.userId || req.headers["x-user-id"];
    
    // If no userId provided, return empty signature (optional signature feature)
    if (!userId) {
      return res.json({
        success: true,
        data: null,
      });
    }
    
    const signature = await signatureService.getSignature(userId);
    
    res.json({
      success: true,
      data: signature,
    });
  } catch (error) {
    console.error("Error fetching signature:", error);
    // Return null instead of error for optional feature
    res.json({
      success: true,
      data: null,
    });
  }
});

/**
 * GET /api/signatures/get
 * Get signature for a specific user
 */
router.get("/get", async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }
    
    const signature = await signatureService.getSignature(userId);
    
    res.json({
      success: true,
      data: signature,
    });
  } catch (error) {
    console.error("Error fetching signature:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
