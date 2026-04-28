/* eslint-disable react-hooks/rules-of-hooks */
import axios from "axios";

// Centralized API client for the Ticket Web app (browser)
// Backend requires Basic Auth for all `/api` routes.

// Fixed backend URLs declared here (no UI-config needed).

const useApiUrl = () => {
  return "/".replace(/\/+$/, "");
};

const API_USERNAME = process.env.REACT_APP_API_USERNAME;
const API_PASSWORD = process.env.REACT_APP_API_PASSWORD;

function getApiCreds() {
  return { user: API_USERNAME, pass: API_PASSWORD };
}

function basicAuthHeader() {
  const { user, pass } = getApiCreds();
  const token = btoa(`${user}:${pass}`);
  return `Basic ${token}`;
}

// Create axios instance with default config
function createAxiosInstance() {
  const instance = axios.create({
    baseURL: `${useApiUrl()}/api`,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": basicAuthHeader(),
    },
  });

  // Response interceptor to handle errors and unwrap data
  instance.interceptors.response.use(
    (response) => {
      const payload = response.data;
      if (payload && payload.success === false) {
        throw new Error(payload.error || "API Error");
      }
      return payload && payload.data !== undefined ? payload.data : payload;
    },
    (error) => {
      const msg =
        (error.response?.data?.error) ||
        (typeof error.response?.data === "string" ? error.response.data : null) ||
        error.message ||
        "Network Error";
      throw new Error(msg);
    }
  );

  return instance;
}

async function request(path, { method = "GET", query, body, headers } = {}) {
  const instance = createAxiosInstance();
  
  try {
    const response = await instance({
      method,
      url: path,
      params: query,
      data: body,
      headers,
    });
    return response;
  } catch (error) {
    throw error;
  }
}

export const Api = {
  // Health
  async health() {
    try {
      const instance = axios.create({
        baseURL: useApiUrl(),
      });
      const res = await instance.get("/health");
      return res.status === 200;
    } catch (e) {
      return false;
    }
  },

  // Auth (app user accounts)
  login({ username, password }) {
    return request("/users/login", { method: "POST", body: { username, password } });
  },

  // Users
  listUsers() {
    return request("/users");
  },
  getUserById(id) {
    return request(`/users/${id}`);
  },
  getOnlineStatus() {
    return request("/users/status/online");
  },
  createUser(payload) {
    return request("/users", { method: "POST", body: payload });
  },
  updateUser(id, payload) {
    return request(`/users/${id}`, { method: "PUT", body: payload });
  },
  deleteUser(id) {
    return request(`/users/${id}`, { method: "DELETE" });
  },
  changePassword(id, payload) {
    return request(`/users/${id}/change-password`, { method: "POST", body: payload });
  },
  logoutAllSessions(userId) {
    return request(`/users/${userId}/logout-all`, { method: "POST" });
  },

  // Customers
  listCustomers() {
    return request("/customers");
  },
  createCustomer(payload) {
    return request("/customers", { method: "POST", body: payload });
  },
  updateCustomer(id, payload) {
    return request(`/customers/${id}`, { method: "PUT", body: payload });
  },
  deleteCustomer(id) {
    return request(`/customers/${id}`, { method: "DELETE" });
  },

  // History
  searchHistory(filters, options = {}) {
    const query = { ...(filters || {}) };
    if (options?.fields) query.fields = options.fields;
    return request("/history", { query });
  },
  getHistoryById(id, options = {}) {
    const query = {};
    if (options?.fields) query.fields = options.fields;
    return request(`/history/${id}`, { query });
  },
  getHistoryByIds(ids) {
    return request("/history/by-ids", { method: "POST", body: { ids } });
  },
  getHistoryByIdsWithFields(ids, options = {}) {
    const query = {};
    if (options?.fields) query.fields = options.fields;
    return request("/history/by-ids", { method: "POST", query, body: { ids } });
  },
  createHistoryWithTicket(payload, date) {
    const query = {};
    if (date) query.date = date;
    return request("/history/create-with-ticket", { method: "POST", query, body: payload });
  },
  updateHistory(id, payload) {
    return request(`/history/${id}`, { method: "PUT", body: payload });
  },
  getHistoryTimeline(id) {
    return request(`/history/${id}/timeline`);
  },
  deleteHistory(id) {
    return request(`/history/${id}`, { method: "DELETE" });
  },
  getNextTicketNumber(date) {
    const query = {};
    if (date) query.date = date;
    return request("/history/next-ticket-number", { query });
  },
  getSuggestions(field) {
    return request("/history/suggestions", { query: { field } })
      .then((res) => {
        // Backend returns { success: true, data: { suggestions: [...] } }
        if (res?.data?.suggestions && Array.isArray(res.data.suggestions)) {
          return res.data.suggestions;
        }
        return [];
      });
  },

  // Translation
  translateTicket(data, targetLanguage) {
    return request("/translate-ticket", { method: "POST", body: { data, targetLanguage } })
      .then((res) => {
        if (res && res.translatedData) return res.translatedData;
        return res;
      });
  },

  // Signatures
  async uploadSignature(userId, signatureDataUrl) {
    const instance = createAxiosInstance();
    try {
      const response = await instance({
        method: "POST",
        url: "/signatures/upload",
        data: { userId, signatureDataUrl },
      });
      return response;
    } catch (error) {
      throw error;
    }
  },
  getSignature(userId) {
    return request("/signatures/get", { query: { userId } });
  },
  getCurrentUserSignature(userId) {
    const query = userId ? { userId } : {};
    return request("/signatures/current", { query });
  },
  listNotifications(userKey, page = 1, pageSize = 50) {
    return request("/notifications", { query: { userKey, page, pageSize } });
  },
  markNotificationRead(id, userKey) {
    return request(`/notifications/${id}/read`, { method: "PUT", body: { userKey } });
  },
};

export { useApiUrl };

