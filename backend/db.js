const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

let client;
let db;

const getConfigPathCandidates = () => {
  // Only use backend-specific config; do not read parent app-config.json
  return [
    path.join(__dirname, "config.json"),
  ];
};

const loadConfig = () => {
  try {
    const candidates = getConfigPathCandidates();
    for (const configPath of candidates) {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, "utf8");
        return JSON.parse(raw) || {};
      }
    }
    return {};
  } catch (err) {
    console.error("Error loading config:", err);
    return {};
  }
};

const connectMongo = async () => {
  if (db) return db;
  const cfg = loadConfig();

  // Allow DB config via environment variables as well
  const envUri = process.env.MONGO_URI;
  const envDbName = process.env.MONGO_DBNAME;

  const mongoUri = (envUri && envUri.trim()) || (cfg.database && cfg.database.mongoUri && cfg.database.mongoUri.trim());
  const dbName = (envDbName && envDbName.trim()) || (cfg.database && cfg.database.dbName && cfg.database.dbName.trim());

  if (!mongoUri) {
    throw new Error("Chưa cấu hình Database URL for backend. Set backend/config.json or MONGO_URI env var.");
  }
  if (!dbName) {
    throw new Error("Chưa cấu hình tên database for backend. Set backend/config.json or MONGO_DBNAME env var.");
  }

  let uri = mongoUri;
  const username = (cfg.database && cfg.database.username) || process.env.MONGO_USER || "";
  const password = (cfg.database && cfg.database.password) || process.env.MONGO_PASS || "";
  
  const hasAuthInUri = uri.includes("@") && /^mongodb(\+srv)?:\/\/[^:]+:[^@]+@/.test(uri);
  
  if (!hasAuthInUri && username && password && username.trim() && password.trim()) {
    const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    const rest = uri.replace(protocol, "");
    const encodedUsername = encodeURIComponent(username.trim());
    const encodedPassword = encodeURIComponent(password.trim());
    uri = `${protocol}${encodedUsername}:${encodedPassword}@${rest}`;
  }
  
  const options = (cfg.database && cfg.database.options) || {};

  try {
    client = new MongoClient(uri, options);
    await client.connect();
    db = client.db(dbName);
    console.log("✓ Connected to MongoDB");
    return db;
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    throw err;
  }
};

const getDb = async () => {
  if (db) return db;
  return connectMongo();
};

const closeConnection = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
};

module.exports = {
  connectMongo,
  getDb,
  closeConnection,
};
