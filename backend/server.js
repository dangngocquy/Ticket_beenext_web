let express, http, cors, initializeSocket, connectMongo;
let ticketService, historyService, customerService, userService, notificationService;
let ticketRoutes, historyRoutes, customerRoutes, userRoutes, signatureRoutes, notificationRoutes;
let translateService;
let app, server, io;

try {
  express = require("express");
  http = require("http");
  cors = require("cors");
  ({ initializeSocket } = require("./socket"));
  ({ connectMongo } = require("./db"));
  ticketService = require("./services/ticket.service");
  historyService = require("./services/history.service");
  customerService = require("./services/customer.service");
  userService = require("./services/user.service");
  notificationService = require("./services/notification.service");
  translateService = require("./translate-service");
  ticketRoutes = require("./routes/ticket.route");
  historyRoutes = require("./routes/history.route");
  customerRoutes = require("./routes/customer.route");
  userRoutes = require("./routes/user.route");
  signatureRoutes = require("./routes/signature.route");
  notificationRoutes = require("./routes/notification.route");

  fs = require("fs");
  path = require("path");

  app = express();
  server = http.createServer(app);
  io = initializeSocket(server);
} catch (err) {
  console.error("\n[Backend] Missing dependency or failed to load backend modules.");
  console.error("Make sure you installed backend dependencies: 'cd backend && npm install'");
  console.error("Original error:", err && err.message ? err.message : err);
  // Re-throw so the caller sees the error stack (but with clearer message above)
  throw err;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Store io instance in app for routes to access
app.set("io", io);

// Health check endpoint (no auth needed)
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// Basic Auth middleware for API routes
const basicAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Use Basic Auth with username and password.",
    });
  }
  
  try {
    const credentials = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const [username, password] = credentials.split(":");
    
    // Determine valid credentials (prefer backend/config.json, then environment variables)
    let configuredUsername;
    let configuredPassword;
    try {
      const backendCfgPath = path.join(__dirname, "config.json");
      if (fs.existsSync(backendCfgPath)) {
        const raw = fs.readFileSync(backendCfgPath, "utf8");
        const cfg = JSON.parse(raw);
        if (cfg && cfg.backend) {
          configuredUsername = cfg.backend.apiUsername;
          configuredPassword = cfg.backend.apiPassword;
        }
      }
    } catch (err) {
      // ignore and fall back to env/defaults
    }

    const VALID_USERNAME = (configuredUsername && configuredUsername.trim()) || process.env.API_USERNAME || "beesnext";
    const VALID_PASSWORD = (configuredPassword && configuredPassword.trim()) || process.env.API_PASSWORD || "beesnext";
    
    if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid authentication header",
    });
  }
};

// Apply basic auth to API routes
app.use("/api", basicAuthMiddleware);

// API Routes
app.use("/api/tickets", ticketRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/users", userRoutes);
app.use("/api/signatures", signatureRoutes);
app.use("/api/notifications", notificationRoutes);

// Translation endpoint with caching and batching
app.post("/api/translate-ticket", async (req, res) => {
  try {
    const { data, targetLanguage } = req.body;

    if (!data || !targetLanguage) {
      return res.status(400).json({
        success: false,
        error: "Data and targetLanguage are required"
      });
    }

    // If target language is Vietnamese, return original data
    if (targetLanguage === "vi") {
      return res.json({
        success: true,
        translatedData: data
      });
    }

    // Use translation service with caching and batching
    const translatedData = await translateService.translateTicketData(data, targetLanguage);

    res.json({
      success: true,
      translatedData: translatedData
    });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Translation failed"
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// Initialize and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectMongo();
    
    // Initialize indexes
    await ticketService.initializeIndexes();
    await historyService.initializeIndexes();
    await customerService.initializeIndexes();
    await userService.initializeIndexes();
    await notificationService.initializeIndexes();
    
    // Start HTTP server
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`\n═══════════════════════════════`);
      console.log(`✓ Backend Server running on port ${PORT}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
      console.log(`✓ Socket.IO ready for real-time updates`);
      console.log(`═══════════════════════════════\n`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("✓ Server closed");
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
