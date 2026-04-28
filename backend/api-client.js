/**
 * API Helper for Electron to communicate with Backend
 * Replaces direct MongoDB access with HTTP API calls
 */

const fs = require("fs");
const path = require("path");
const { app } = require("electron");

// Get backend configuration from desktop/user config first (userData app-config.json),
// then fallback to backend/config.json or environment variables.
const getBackendConfig = () => {
  try {
    // 1) Try userData app-config.json (desktop config saved by UI)
    if (app && typeof app.getPath === 'function') {
      const userDataPath = app.getPath('userData');
      const cfgPath = path.join(userDataPath, 'app-config.json');
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        const cfg = JSON.parse(raw);
        return cfg.backend || {};
      }
    }

    // 2) Try backend/config.json
    const backendCfgPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(backendCfgPath)) {
      const raw = fs.readFileSync(backendCfgPath, 'utf8');
      const cfg = JSON.parse(raw);
      return cfg.backend || {};
    }
  } catch (err) {
    console.error("Error loading backend config:", err);
  }
  return {};
};

const backendConfig = getBackendConfig();

function resolveBackendBase() {
  const cfg = getBackendConfig();
  const raw = (process.env.BACKEND_URL && process.env.BACKEND_URL.trim()) || cfg.backendUrl || backendConfig.backendUrl;
  return String(raw).replace(/\/api\/?$/i, "").replace(/\/+$/i, "");
}

function resolveCredentials() {
  const cfg = getBackendConfig();
  const user = (process.env.API_USERNAME && process.env.API_USERNAME.trim()) || cfg.apiUsername || backendConfig.apiUsername;
  const pass = (process.env.API_PASSWORD && process.env.API_PASSWORD.trim()) || cfg.apiPassword || backendConfig.apiPassword;
  return { user, pass };
}

// Helper function để gọi API
async function apiCall(endpoint, options = {}) {
  try {
    const base = resolveBackendBase();
    const url = `${base}/api${endpoint}`;

    // Create Basic Auth header from current config
    const creds = resolveCredentials();
    const credentials = Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");

    const config = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${credentials}`,
        ...(options.headers || {}),
      },
    };

    const response = await fetch(url, config);
    const data = await response.json();

    // Normalize API responses: the backend uses `{ success: true|false, data, error }`.
    // Treat explicit `success: false` as an error even when HTTP status is 200.
    if (!response.ok || (data && data.success === false)) {
      throw new Error((data && data.error) ? data.error : `API Error: ${response.status}`);
    }

    return data && data.data !== undefined ? data.data : data;
  } catch (error) {
    // Normalize common network/fetch errors to a friendly Vietnamese message
    console.error(`API Error (${endpoint}):`, error && error.message ? error.message : error);
    const msg = (error && error.message) ? error.message : String(error);
    const networkPattern = /fetch failed|failed to fetch|network|enotfound|econnrefused|enetunreach/i;
    if (networkPattern.test(msg)) {
      throw new Error("Mất kết nối đến máy chủ, vui lòng kiểm tra lại");
    }
    // If the backend returned a structured error, preserve it; otherwise rethrow original
    throw error;
  }
}

// Ticket API
const ticketAPI = {
  async create(ticketData) {
    return apiCall("/tickets", {
      method: "POST",
      body: JSON.stringify(ticketData),
    });
  },

  async getAll(filter = {}) {
    const query = new URLSearchParams();
    if (Object.keys(filter).length > 0) {
      query.append("filter", JSON.stringify(filter));
    }
    return apiCall(`/tickets?${query.toString()}`);
  },

  async getById(id) {
    return apiCall(`/tickets/${id}`);
  },

  async update(id, updateData) {
    return apiCall(`/tickets/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  },

  async delete(id) {
    return apiCall(`/tickets/${id}`, {
      method: "DELETE",
    });
  },
};

// History API
const historyAPI = {
  async getNextTicketNumber(dateStr = null) {
    const query = new URLSearchParams();
    if (dateStr) {
      query.append("date", dateStr);
    }
    return apiCall(`/history/next-ticket-number?${query.toString()}`);
  },

  async add(historyData) {
    return apiCall("/history", {
      method: "POST",
      body: JSON.stringify(historyData),
    });
  },

  async search(params = {}) {
    const query = new URLSearchParams();
    if (params.keyword) query.append("keyword", params.keyword);
    if (params.from) query.append("from", params.from);
    if (params.to) query.append("to", params.to);
    if (params.company) query.append("company", params.company);
    if (params.printed !== undefined) query.append("printed", params.printed);
    if (params.createdBy) query.append("createdBy", params.createdBy);
    if (params.nguoiThucHien) query.append("nguoiThucHien", params.nguoiThucHien);
    if (params.page) query.append("page", params.page);
    if (params.pageSize) query.append("pageSize", params.pageSize);

    const result = await apiCall(`/history?${query.toString()}`);
    return result;
  },

  async getAll() {
    return apiCall("/history/all");
  },

  async update(id, updateData) {
    return apiCall(`/history/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  },

  async delete(id) {
    return apiCall(`/history/${id}`, {
      method: "DELETE",
    });
  },

  async getSuggestions(field) {
    return apiCall(`/history/suggestions?field=${field}`);
  },
};

// Customer API
const customerAPI = {
  async getAll() {
    return apiCall("/customers");
  },

  async create(customerData) {
    return apiCall("/customers", {
      method: "POST",
      body: JSON.stringify(customerData),
    });
  },

  async update(id, updateData) {
    return apiCall(`/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  },

  async delete(id) {
    return apiCall(`/customers/${id}`, {
      method: "DELETE",
    });
  },
};

// User API
const userAPI = {
  async getAll() {
    return apiCall("/users");
  },

  async getById(id) {
    return apiCall(`/users/${id}`);
  },

  async login(username, password) {
    const result = await apiCall("/users/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return result;
  },

  async create(userData) {
    return apiCall("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  async update(id, updateData) {
    return apiCall(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  },

  async delete(id) {
    return apiCall(`/users/${id}`, {
      method: "DELETE",
    });
  },
};

module.exports = {
  apiCall,
  ticketAPI,
  historyAPI,
  customerAPI,
  userAPI,
};
