import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import {
  App as AntApp,
  Button,
  ConfigProvider,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Layout,
  Menu,
} from "antd";
import {
  FileTextOutlined,
  HomeOutlined,
  HistoryOutlined,
  LockOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import { Api } from "./service/Api";
import { connectSocket, disconnectSocket, getSocket } from "./service/websoket";
import PageLoader from "./component/PageLoader";
import { jsPDF } from "jspdf";
import { renderToStaticMarkup } from "react-dom/server";
import appConfig from "./app-config.json";
import Preview from "./component/Viewprint";
const Login = lazy(() => import("./component/Login"));
const Header = lazy(() => import("./component/Header"));
const IncidentTab = lazy(() => import("./component/Incident"));
const HistoryTab = lazy(() => import("./component/History"));
const AccountTab = lazy(() => import("./component/Account"));
const CustomerTab = lazy(() => import("./component/Customer"));
const SettingsTab = lazy(() => import("./component/Settings"));
const ChangePasswordPage = lazy(() => import("./component/ChangePasswordPage"));
const UserAvatar = lazy(() => import("./component/UserAvatar"));
const CustomerDashboard = lazy(() => import("./component/customer/CustomerDashboard"));
const CustomerAccountManagement = lazy(() => import("./component/customer/CustomerAccountManagement"));

const theme = {
  token: {
    colorPrimary: "#ed3237",
    colorPrimaryHover: "#d6282c",
    colorPrimaryActive: "#b81e22",
  },
};

const AUTH_KEY = "ticket_auth_user_v1";
const LANGUAGE_KEY = "selectedLanguage";
const cfg = appConfig || {};

function TicketContent() {
  const { message, modal } = AntApp.useApp();

  const navigate = useNavigate();
  const { tab } = useParams();
  const {
    authUser,
    setAuthUser,
    pushAssignmentNotification,
    pendingNotificationPreview,
    clearPendingNotificationPreview,
    formPrintPreviewOpen,
    setFormPrintPreviewOpen,
    formPrintPreviewData,
    setFormPrintPreviewData,
    setFormPrintPreviewLoading,
    setFormPrintPreviewPrintAction,
  } = useOutletContext();
  const user = authUser;
  const setUser = setAuthUser;

  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_KEY) || "vi";
    } catch (e) {
      return "vi";
    }
  });
  const [translations, setTranslations] = useState(null);

  const [form] = Form.useForm();
  const [createUserForm] = Form.useForm();
  const permission = Form.useWatch("permission", createUserForm);
  const formStatus = Form.useWatch("status", form);

  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [usersLoading, setUsersLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [userStatus, setUserStatus] = useState({});

  const resolvePerformerName = useCallback((input) => {
    const key = String(input || "").trim();
    if (!key) return "";
    const normalized = key.toLowerCase();

    const match = (users || []).find((u) => {
      const username = String(u?.username || "").trim().toLowerCase();
      const userKey = String(u?.key || "").trim().toLowerCase();
      const fullName = String(u?.fullNamePrivate || "").trim().toLowerCase();
      return (
        (username && username === normalized) ||
        (userKey && userKey === normalized) ||
        (fullName && fullName === normalized)
      );
    });

    if (match) {
      const formatted = String(match.fullNamePrivate || match.username || match.key || "").trim();
      if (formatted) return formatted;
    }

    return key;
  }, [users]);

  const getPerformerUser = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return null;
    return (users || []).find((u) => {
      const username = String(u?.username || "").trim();
      const userKey = String(u?.key || "").trim();
      const fullName = String(u?.fullNamePrivate || "").trim();
      const userId = String(u?.id || u?._id || "").trim();
      const email = String(u?.email || "").trim();
      return (
        raw === username ||
        raw === userKey ||
        raw === fullName ||
        raw === userId ||
        raw === email
      );
    });
  };
  const getUserAssignValue = (u) =>
    String(u?.key || u?.username || u?.fullNamePrivate || u?.id || u?._id || "").trim();

  const getCkEditorHtmlValue = (name) => {
    try {
      const editor = window?.ckEditorInstances?.[name];
      if (editor && typeof editor.getData === "function") {
        return String(editor.getData() || "").trim();
      }
    } catch (e) {
      // ignore
    }
    return undefined;
  };

  const [customersLoading, setCustomersLoading] = useState(false);
  const [usersFilter, setUsersFilter] = useState("");
  const [customersFilter, setCustomersFilter] = useState("");
  const [usersDrawerVisible, setUsersDrawerVisible] = useState(false);
  const [customersDrawerVisible, setCustomersDrawerVisible] = useState(false);
  const [customerAccountCreationVisible, setCustomerAccountCreationVisible] = useState(false);
  const [customerAccountCreationLoading, setCustomerAccountCreationLoading] = useState(false);
  const [customerSelectModalVisible, setCustomerSelectModalVisible] = useState(false);
  const [customerSelectModalLoading, setCustomerSelectModalLoading] = useState(false);
  const [selectedCustomerForUser, setSelectedCustomerForUser] = useState(null);
  const [pendingCustomerUser, setPendingCustomerUser] = useState(null);

  const [filters, setFilters] = useState({ page: 1, pageSize: 15 });
  const filtersRef = useRef({ page: 1, pageSize: 15 });
  const customersLoadingRef = useRef(false);
  const usersLoadingRef = useRef(false);
  const historyLoadingRef = useRef(false);
  const lastCustomersLoadAtRef = useRef(0);
  const lastUsersLoadAtRef = useRef(0);
  const lastHistoryLoadAtRef = useRef(0);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const getSavedHistoryFilters = useCallback(() => {
    try {
      const serverSaved = user?.savedHistoryFilters;
      if (!serverSaved) return null;
      if (typeof serverSaved === "string") {
        try {
          const parsedServer = JSON.parse(serverSaved);
          return parsedServer?.filters || parsedServer || null;
        } catch (err) {
          return null;
        }
      }
      if (typeof serverSaved === "object") {
        return serverSaved?.filters || serverSaved || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }, [user]);

  const savedHistoryFiltersJson = JSON.stringify(user?.savedHistoryFilters || null);

  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyFrom, setHistoryFrom] = useState(null);
  const [historyTo, setHistoryTo] = useState(null);
  const [historyCompany, setHistoryCompany] = useState(undefined);
  const [historyPrinted, setHistoryPrinted] = useState(undefined);
  const [historyStatus, setHistoryStatus] = useState(undefined);
  const [historyLoaiPhieu, setHistoryLoaiPhieu] = useState(undefined);
  const [historyNguoiThucHien, setHistoryNguoiThucHien] = useState(undefined);
  const historyKeywordDebounceRef = useRef(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Ticket History edit modal
  const [historyEditRecord, setHistoryEditRecord] = useState(null);
  const [historyEditForm] = Form.useForm();

  const [formResetKey, setFormResetKey] = useState(0);
  const [assignStatusModalVisible, setAssignStatusModalVisible] = useState(false);
  const [assignStatusPerformer, setAssignStatusPerformer] = useState("");

  // Form UX helpers
  const [savingTicket, setSavingTicket] = useState(false);
  const [printingTicket, setPrintingTicket] = useState(false);

  // tinhTrang autocomplete suggestions (Ticket Incident form)
  const [tinhTrangSuggestions, setTinhTrangSuggestions] = useState([]);
  const [tinhTrangFilteredOptions, setTinhTrangFilteredOptions] = useState([]);
  const [tinhTrangSearchValue, setTinhTrangSearchValue] = useState("");

  // Batch printing (Ticket History)
  const [confirmPrintModalVisible, setConfirmPrintModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0, success: [], failed: [] });
  const printCancelledRef = useRef(false);
  const soPhieuLockRef = useRef(Promise.resolve());

  const loadTranslations = async (lang, showNotification = false) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, lang);
    } catch (e) {}
    setSelectedLanguage(lang);

    if (lang === "vi") {
      setTranslations(null);
      if (showNotification) message.success("Đã chuyển sang ngôn ngữ: Tiếng Việt");
      return;
    }

    try {
      const res = await fetch(`/js/languages/${lang}.json`, { cache: "no-store" });
      if (!res.ok) throw new Error("Không tìm thấy file ngôn ngữ");
      const data = await res.json();
      setTranslations(data || null);
      if (showNotification) message.success(`Đã chuyển sang ngôn ngữ: ${lang === "en" ? "English" : lang}`);
    } catch (e) {
      setTranslations(null);
      if (showNotification) message.warning("Không tải được file dịch, dùng ngôn ngữ mặc định");
    }
  };

  const withSoPhieuLock = (fn) => {
    const p = soPhieuLockRef.current.then(() => fn());
    soPhieuLockRef.current = p.catch(() => {});
    return p;
  };

  const ensureFormSoPhieu = async ({ force = false } = {}) =>
    withSoPhieuLock(async () => {
      const current = String(form.getFieldValue("soPhieu") || "").trim();
      if (current && !force) return current;

      const rawDate = form.getFieldValue("ngay");
      const dateStr = rawDate ? dayjs(rawDate).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY");
      try {
        const res = await Api.getNextTicketNumber(dateStr);
        const next = String(res?.ticketNumber || res?.soPhieu || "").trim();
        if (next) {
          form.setFieldsValue({ soPhieu: next });
          return next;
        }
      } catch (e) {}
      return current;
    });

  const maybeTranslateTicketData = useCallback(async (data, options = {}) => {
    const { showLoading = false } = options;
    if (!data || selectedLanguage === "vi") return data;
    let hide = null;
    try {
      if (showLoading) {
        hide = message.loading(
          `Đang dịch sang ${selectedLanguage === "en" ? "English" : selectedLanguage}...`,
          0
        );
      }
      const translated = await Api.translateTicket(data, selectedLanguage);
      return translated || data;
    } catch (e) {
      return data;
    } finally {
      try {
        hide?.();
      } catch (err) {}
    }
  }, [message, selectedLanguage]);

  const loadCustomers = useCallback(async () => {
    const now = Date.now();
    if (customersLoadingRef.current || now - lastCustomersLoadAtRef.current < 1000) {
      return;
    }
    customersLoadingRef.current = true;
    lastCustomersLoadAtRef.current = now;
    setCustomersLoading(true);
    try {
      const rows = await Api.listCustomers();
      const sorted = (rows || []).sort((a, b) => {
        // Sort by createdAt descending (newest first)
        const aTime = new Date(a?.createdAt || a?.createdTime || 0).getTime();
        const bTime = new Date(b?.createdAt || b?.createdTime || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        // Fallback: sort by id descending
        const aId = String(a?.id || a?._id || "");
        const bId = String(b?.id || b?._id || "");
        return bId.localeCompare(aId);
      });
      setCustomers(sorted);
    } finally {
      customersLoadingRef.current = false;
      setCustomersLoading(false);
    }
  }, []);
  const loadUsers = useCallback(async () => {
    const now = Date.now();
    if (usersLoadingRef.current || now - lastUsersLoadAtRef.current < 1000) {
      return;
    }
    usersLoadingRef.current = true;
    lastUsersLoadAtRef.current = now;
    setUsersLoading(true);
    try {
      const rows = await Api.listUsers();
      const sorted = (rows || []).sort((a, b) => {
        // Sort by createdAt descending (newest first)
        const aTime = new Date(a?.createdAt || a?.createdTime || 0).getTime();
        const bTime = new Date(b?.createdAt || b?.createdTime || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        // Fallback: sort by id descending
        const aId = String(a?.id || a?._id || "");
        const bId = String(b?.id || b?._id || "");
        return bId.localeCompare(aId);
      });
      const userRows = sorted;
      setUsers(userRows);

      // If current user was force-logged-out remotely, kick them out immediately.
      try {
        const currentUser = userRef.current;
        const myKey = String(currentUser?.key || "").trim();
        const myUsername = String(currentUser?.username || "").trim();
        const myId = String(currentUser?.id || currentUser?._id || "").trim();
        if (myKey || myUsername || myId) {
          const matched = (userRows || []).find((u) => {
            const uid = String(u?.id || u?._id || "").trim();
            const ukey = String(u?.key || "").trim();
            const uname = String(u?.username || "").trim();
            return (myId && uid && myId === uid) || (myKey && ukey && myKey === ukey) || (myUsername && uname && myUsername === uname);
          });
          const forceLogoutAt = matched?.forceLogoutAt ? new Date(matched.forceLogoutAt).getTime() : 0;
          const sessionStartedAt = Number(currentUser?.sessionStartedAt || 0);
          if (forceLogoutAt && sessionStartedAt && forceLogoutAt > sessionStartedAt) {
            message.warning("Phiên đăng nhập của bạn đã bị đăng xuất từ xa.");
            setUser(null);
            navigate("/login", { replace: true });
            return;
          }
        }
      } catch (e) {}

      // Keep logged-in user profile/permission in sync in real-time.
      setUser((prev) => {
        if (!prev) return prev;
        const prevId = String(prev?.id || prev?._id || "").trim();
        const prevKey = String(prev?.key || "").trim();
        const prevUsername = String(prev?.username || "").trim();
        const matched = (userRows || []).find((u) => {
          const uid = String(u?.id || u?._id || "").trim();
          const ukey = String(u?.key || "").trim();
          const uname = String(u?.username || "").trim();
          return (prevId && uid && prevId === uid) || (prevKey && ukey && prevKey === ukey) || (prevUsername && uname && prevUsername === uname);
        });
        if (!matched) return prev;
        const merged = { ...(prev || {}), ...(matched || {}) };
        const same =
          String(prev?.id || prev?._id || "") === String(merged?.id || merged?._id || "") &&
          String(prev?.key || "") === String(merged?.key || "") &&
          String(prev?.username || "") === String(merged?.username || "") &&
          String(prev?.fullNamePrivate || "") === String(merged?.fullNamePrivate || "") &&
          String(prev?.chucVu || "") === String(merged?.chucVu || "") &&
          String(prev?.canManage || "") === String(merged?.canManage || "") &&
          String(prev?.canEdit || "") === String(merged?.canEdit || "");
        return same ? prev : merged;
      });
    } finally {
      usersLoadingRef.current = false;
      setUsersLoading(false);
    }
  }, [message, navigate, setUser]);

  const loadHistory = useCallback(async (extra = {}) => {
    const now = Date.now();
    if (historyLoadingRef.current || now - lastHistoryLoadAtRef.current < 1000) {
      return;
    }
    historyLoadingRef.current = true;
    lastHistoryLoadAtRef.current = now;
    setHistoryLoading(true);
    try {
      const next = { ...filtersRef.current, ...extra };
      setFilters(next);
      // Remove undefined/null/empty values so backend query params don't receive "undefined"
      const query = Object.fromEntries(
        Object.entries(next || {}).filter(([_, v]) => v !== undefined && v !== null && v !== "")
      );
      // Default: only fetch lightweight fields for list/table rendering.
      // Heavy HTML/text fields are fetched on-demand when opening preview/print/edit.
      const HISTORY_LIST_FIELDS = [
        "_id",
        "soPhieu",
        "ngay",
        "khachHang",
        "diaChi",
        "nguoiLienHe",
        "phone",
        "nguoiThucHien",
        "tinhTrang",
        "phiDichVu",
        "status",
        "printed",
        "nguoiInPhieu",
        "loaiPhieu",
        "rating",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
        "followers",
      ].join(",");

      const res = await Api.searchHistory(query, { fields: HISTORY_LIST_FIELDS });
      setHistory(res?.data || []);
      setHistoryTotal(res?.total || 0);
    } finally {
      historyLoadingRef.current = false;
      setHistoryLoading(false);
    }
  }, []);

  const isTruthyManagePermission = (v) =>
    v === true || v === "true" || String(v || "").trim() === "Chỉnh sửa";
  const confirmDelete = (title, content, onOk) => {
    modal.confirm({
      title,
      content,
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      centered: true,
      onOk: () => onOk?.(),
    });
  };

  const isAdminUser = String(user?.username || user?.key || "")
    .trim()
    .toLowerCase() === "admin";
  const performerDisplayName = resolvePerformerName(user?.fullNamePrivate || user?.username || user?.key || "");
  const canManagePermission = isTruthyManagePermission(user?.canManage) || isAdminUser;
  const isCustomerUser = user?.customerRole === true || user?.customerRole === "true";
  const canManageTabVisible = canManagePermission;

  const permissionLabels = cfg?.ui?.permissions || {};

  const canEditHistoryRecord = (record) => {
    if (!user) return false;
    if (canManagePermission) return true;
    // If user is granted edit permission, allow editing regardless of performer/ownership.
    if (isTruthyManagePermission(user?.canManage) || isTruthyManagePermission(user?.canEdit)) return true;

    const normalizedUserIds = [user?.key, user?.username, user?.fullNamePrivate, user?.id, user?._id, user?.email]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);
    if (normalizedUserIds.length === 0) return false;

    const performer = String(record?.nguoiThucHien || "").trim().toLowerCase();
    if (normalizedUserIds.includes(performer)) return true;

    const matchedPerformer = getPerformerUser(record?.nguoiThucHien);
    if (matchedPerformer) {
      const performerIds = [matchedPerformer?.key, matchedPerformer?.username, matchedPerformer?.fullNamePrivate]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      return performerIds.some((id) => normalizedUserIds.includes(id));
    }

    return false;
  };

  const handleCreateUser = async (vals) => {
    const permission = vals?.permission || "none";
    let canManage = false;
    let canEdit = false;
    let customerRole = false;
    let assignedCustomer = null;
    if (permission === "manage") {
      canManage = true;
      canEdit = true;
    } else if (permission === "edit") {
      canManage = "Chỉnh sửa";
      canEdit = true;
    } else if (permission === "customer") {
      customerRole = true;
      assignedCustomer = vals.assignedCustomer;
    }

    try {
      await Api.createUser({
        username: vals.username,
        password: vals.password,
        fullNamePrivate: vals.fullNamePrivate || "",
        chucVu: vals.chucVu || "",
        canManage,
        canEdit,
        customerRole,
        assignedCustomer,
      });
      message.success("Đã thêm user");
      setUsersDrawerVisible(false);
      createUserForm.resetFields();
      await loadUsers();
    } catch (e) {
      message.error(e?.message || "Lỗi thêm user");
    }
  };

  const handleCreateCustomerAccount = async (vals) => {
    try {
      setCustomerAccountCreationLoading(true);
      await Api.createUser({
        username: vals.username,
        password: vals.password,
        fullNamePrivate: vals.fullNamePrivate || "",
        chucVu: vals.chucVu || "",
        customerRole: true,
        assignedCustomer: vals.assignedCustomer,
        canManage: false,
        canEdit: false,
      });
      message.success("Đã thêm tài khoản chi nhánh");
      setCustomerAccountCreationVisible(false);
      await loadUsers();
    } catch (e) {
      message.error(e?.message || "Lỗi thêm tài khoản");
    } finally {
      setCustomerAccountCreationLoading(false);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (!id) {
      message.error("Không tìm thấy ID");
      return;
    }
    confirmDelete("Xóa tài khoản", `Bạn có chắc muốn xóa tài khoản ${username || id}?`, async () => {
      try {
        await Api.deleteUser(String(id));
        message.success("Đã xóa user");
        await loadUsers();
      } catch (e) {
        message.error(e?.message || "Lỗi xóa user");
      }
    });
  };

  const handleToggleUserPermission = async (record, val) => {
    if (!record) return;
    const id = record.id || record._id;
    if (!id) {
      message.error("Không tìm thấy ID");
      return;
    }

    if (val === "customer") {
      setPendingCustomerUser(record);
      setCustomerSelectModalVisible(true);
      return;
    }

    let nextCanManage = false;
    let nextCanEdit = false;
    let nextCustomerRole = false;
    if (val === "manage") {
      nextCanManage = true;
      nextCanEdit = true;
    } else if (val === "edit") {
      nextCanManage = false;
      nextCanEdit = true;
    }

    setUsers((prev) =>
      (prev || []).map((u) =>
        String(u.id || u._id) === String(id)
          ? { ...u, canManage: nextCanManage, canEdit: nextCanEdit, customerRole: nextCustomerRole }
          : u
      )
    );

    try {
      await Api.updateUser(String(id), { canManage: nextCanManage, canEdit: nextCanEdit, customerRole: nextCustomerRole });
      const permissionText =
        val === "manage"
          ? permissionLabels.manageLabel || "Quản lý"
          : val === "edit"
            ? permissionLabels.editLabel || "Chỉnh sửa"
            : permissionLabels.noneLabel || "Không có quyền";
      message.success(`Đã cập nhật quyền thành "${permissionText}"`);
      if (user && String(user.id || user._id) === String(id)) {
        setUser((prev) => ({ ...(prev || {}), canManage: nextCanManage, canEdit: nextCanEdit, customerRole: nextCustomerRole }));
      }
    } catch (e) {
      await loadUsers();
      message.error(e?.message || "Lỗi cập nhật quyền");
    }
  };

  const handleEditUser = async (id, vals) => {
    if (!id) {
      message.error("Không tìm thấy ID");
      return;
    }

    const currentUserInList = users.find((u) => String(u.id || u._id) === String(id));
    if (!currentUserInList) {
      message.error("Không tìm thấy user");
      return;
    }

    const updateData = {
      fullNamePrivate: vals.fullNamePrivate !== undefined ? vals.fullNamePrivate : currentUserInList.fullNamePrivate,
      chucVu: vals.chucVu !== undefined ? vals.chucVu : currentUserInList.chucVu,
    };

    if (vals.password && vals.password.trim() !== "") {
      updateData.password = vals.password;
    }

    if (canManagePermission) {
      if (vals.canManage !== undefined) updateData.canManage = vals.canManage;
      if (vals.canEdit !== undefined) updateData.canEdit = vals.canEdit;
      if (vals.customerRole !== undefined) updateData.customerRole = vals.customerRole;
      if (vals.assignedCustomer !== undefined) updateData.assignedCustomer = vals.assignedCustomer;
    }

    try {
      const updated = await Api.updateUser(String(id), updateData);
      message.success("Đã cập nhật user");
      await loadUsers();
      if (user && String(user.id || user._id) === String(id)) {
        setUser(updated);
      }
    } catch (e) {
      message.error(e?.message || "Lỗi cập nhật user");
    }
  };

  const handleRemoteLogoutUser = async (record) => {
    if (!canManagePermission) return;
    const id = String(record?.id || record?._id || "").trim();
    const username = String(record?.username || record?.key || "").trim();
    if (!id) {
      message.error("Không tìm thấy ID user");
      return;
    }
    if (String(username).trim().toLowerCase() === "admin") {
      message.warning("Không thể đăng xuất từ xa tài khoản admin");
      return;
    }
    modal.confirm({
      title: "Đăng xuất từ xa",
      content: `Bạn có chắc muốn đăng xuất TẤT CẢ phiên của tài khoản "${username || id}"?`,
      okText: "Đăng xuất",
      cancelText: "Hủy",
      centered: true,
      onOk: async () => {
        try {
          await Api.logoutAllSessions(id);
          message.success("Đã đăng xuất từ xa");
          await loadUsers();
        } catch (e) {
          message.error(e?.message || "Không thể đăng xuất từ xa");
        }
      },
    });
  };

  const handleCreateCustomer = async (vals) => {
    try {
      const contacts = (vals.contacts || []).filter((c) => c.name && String(c.name).trim());
      await Api.createCustomer({
        companyName: vals.companyName,
        contacts: contacts.length > 0 ? contacts : [],
        address: vals.address || "",
        // Keep old format fields for backward compatibility
        name: contacts.length > 0 ? contacts[0].name : vals.name || "",
        phone: contacts.length > 0 ? (contacts[0].phone || "") : (vals.phone || ""),
      });
      message.success("Đã thêm khách hàng");
      setCustomersDrawerVisible(false);
      await loadCustomers();
    } catch (e) {
      message.error(e?.message || "Lỗi thêm khách hàng");
    }
  };

  const handleSelectCustomerForUser = async () => {
    if (!pendingCustomerUser || !selectedCustomerForUser) {
      message.error("Vui lòng chọn công ty");
      return;
    }
    try {
      setCustomerSelectModalLoading(true);
      await Api.updateUser(String(pendingCustomerUser.id || pendingCustomerUser._id), {
        customerRole: true,
        assignedCustomer: selectedCustomerForUser,
        canManage: false,
        canEdit: false,
      });

      message.success("Đã cập nhật quyền thành Khách hàng");
      setCustomerSelectModalVisible(false);
      setPendingCustomerUser(null);
      setSelectedCustomerForUser(null);
      await loadUsers();
    } catch (e) {
      message.error(e?.message || "Lỗi cập nhật quyền");
    } finally {
      setCustomerSelectModalLoading(false);
    }
  };

  const handleEditCustomer = async (id, vals) => {
    if (!id) {
      message.error("Không tìm thấy ID");
      return;
    }
    try {
      const contacts = (vals.contacts || []).filter((c) => c.name && String(c.name).trim());
      await Api.updateCustomer(String(id), {
        companyName: vals.companyName,
        contacts: contacts.length > 0 ? contacts : [],
        address: vals.address || "",
        // Keep old format fields for backward compatibility
        name: contacts.length > 0 ? contacts[0].name : vals.name || "",
        phone: contacts.length > 0 ? (contacts[0].phone || "") : (vals.phone || ""),
      });
      message.success("Đã cập nhật khách hàng");
      await loadCustomers();
    } catch (e) {
      message.error(e?.message || "Lỗi cập nhật khách hàng");
    }
  };

  const handleDeleteCustomer = async (id, companyName) => {
    if (!id) {
      message.error("Không tìm thấy ID");
      return;
    }
    confirmDelete("Xóa khách hàng", `Bạn có chắc muốn xóa khách hàng ${companyName || ""}?`, async () => {
      try {
        await Api.deleteCustomer(String(id));
        message.success("Đã xóa khách hàng");
        await loadCustomers();
      } catch (e) {
        message.error(e?.message || "Lỗi xóa khách hàng");
      }
    });
  };

  const handleApplyHistoryFilters = async (override = {}) => {
    // Backend expects both `from` & `to` for range filtering.
    const has = (k) => Object.prototype.hasOwnProperty.call(override, k);
    const keyword = has("keyword") ? override.keyword : historyKeyword;
    const fromVal = has("from") ? override.from : historyFrom;
    const toVal = has("to") ? override.to : historyTo;
    const company = has("company") ? override.company : historyCompany;
    const printed = has("printed") ? override.printed : historyPrinted;
    const status = has("status") ? override.status : historyStatus;
    const loaiPhieu = has("loaiPhieu") ? override.loaiPhieu : historyLoaiPhieu;
    const nguoiThucHien = has("nguoiThucHien") ? override.nguoiThucHien : historyNguoiThucHien;

    const extra = {
      page: 1,
      keyword: keyword || undefined,
      from: fromVal ? dayjs(fromVal).format("YYYY-MM-DD") : undefined,
      to: toVal ? dayjs(toVal).format("YYYY-MM-DD") : undefined,
      company: company || undefined,
      printed,
      status: status || undefined,
      loaiPhieu: loaiPhieu || undefined,
      nguoiThucHien: nguoiThucHien || undefined,
    };

    // Only keep from/to if both are provided.
    if (!extra.from || !extra.to) {
      extra.from = undefined;
      extra.to = undefined;
    }
    setSelectedRowKeys([]);
    await loadHistory(extra);
  };

  const handleResetHistoryFilters = async () => {
    setHistoryKeyword("");
    setHistoryFrom(null);
    setHistoryTo(null);
    setHistoryCompany(undefined);
    setHistoryPrinted(undefined);
    setHistoryStatus(undefined);
    setHistoryLoaiPhieu(undefined);
    setHistoryNguoiThucHien(undefined);
    setSelectedRowKeys([]);
    await loadHistory({ page: 1, keyword: undefined, from: undefined, to: undefined, company: undefined, printed: undefined, status: undefined, loaiPhieu: undefined, nguoiThucHien: undefined });
  };

  const handleExportSupportStatsExcel = async () => {
    try {
      setExportingExcel(true);
      const exceljsMod = await import("exceljs/dist/exceljs.js");
      const ExcelJS = exceljsMod?.default || exceljsMod;

      const buildQuery = (obj) =>
        Object.fromEntries(Object.entries(obj || {}).filter(([_, v]) => v !== undefined && v !== null && v !== ""));
      const query = buildQuery({ ...filters, page: 1, pageSize: 10000 });
      // Export: only request fields that are actually used in the excel sheets.
      const EXPORT_HISTORY_FIELDS = [
        "_id",
        "soPhieu",
        "ngay",
        "khachHang",
        "diaChi",
        "nguoiLienHe",
        "phone",
        "nguoiThucHien",
        "tinhTrang",
        "phuongAnXuLy",
        "phuongAnXuLyHtml",
        "ketQua",
        "ketQuaHtml",
        "phiDichVu",
        "status",
        "printed",
        "loaiPhieu",
        "rating",
        "createdBy",
        "updatedBy",
        "createdAt",
        "updatedAt",
      ].join(",");

      const res = await Api.searchHistory(query, { fields: EXPORT_HISTORY_FIELDS });
      const rows = Array.isArray(res?.data) ? res.data : [];

      const safeString = (v) => (v === null || v === undefined ? "" : String(v));
      const toBoolean = (v) => v === true || v === "true";
      const normalizeStatus = (s) => {
        const v = safeString(s).trim().toLowerCase();
        if (
          !v ||
          v === "hoàn tất" ||
          v === "hoan tat" ||
          v === "done" ||
          v === "completed" ||
          v === "closed"
        ) {
          return "closed";
        }
        if (
          v === "pending" ||
          v === "đang xử lý" ||
          v === "dang xu ly" ||
          v === "in progress" ||
          v === "in_progress" ||
          v === "inprogress"
        ) {
          return "in_progress";
        }
        if (v === "resolved") return "resolved";
        if (v === "assigned") return "assigned";
        if (v === "new") return "new";
        return v;
      };
      const normalizePlainText = (text) =>
        String(text || "").replace(/[ \t\u00A0]+/g, " ").trim();
      const htmlToText = (html) =>
        String(html || "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/[ \t\u00A0]+/g, " ")
          .replace(/\n{2,}/g, "\n")
          .trim();
      const formatTicketDate = (r) => {
        const v = r?.ngay || r?.createdAt || "";
        if (!v) return "";
        const d = dayjs(v, ["DD/MM/YYYY", "DD/MM/YYYY HH:mm:ss", dayjs.ISO_8601], true);
        if (d.isValid()) return d.format("DD/MM/YYYY");
        const d2 = dayjs(v);
        if (d2.isValid()) return d2.format("DD/MM/YYYY");
        return safeString(v);
      };

      const byPerformer = new Map();
      const byCompany = new Map();
      rows.forEach((r) => {
        const perf = resolvePerformerName(r.nguoiThucHien) || "Chưa rõ";
        const companyName = safeString(r.khachHang).trim() || "Chưa rõ";
        const st = normalizeStatus(r.status);
        const isPrinted = toBoolean(r.printed);
        const p = byPerformer.get(perf) || { total: 0, completed: 0, pending: 0, printed: 0, unprinted: 0 };
        p.total += 1;
        if (st === "resolved" || st === "closed") p.completed += 1;
        else p.pending += 1;
        if (isPrinted) p.printed += 1;
        else p.unprinted += 1;
        byPerformer.set(perf, p);

        const c = byCompany.get(companyName) || { total: 0, completed: 0, pending: 0, printed: 0, unprinted: 0 };
        c.total += 1;
        if (st === "resolved" || st === "closed") c.completed += 1;
        else c.pending += 1;
        if (isPrinted) c.printed += 1;
        else c.unprinted += 1;
        byCompany.set(companyName, c);
      });

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "BeeNext";
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFED3237" } };
      const headerFont = { bold: true, color: { argb: "FFFFFFFF" } };
      const thin = { style: "thin", color: { argb: "FFD9D9D9" } };
      const makeHeader = (row, headers) => {
        row.values = headers;
        headers.forEach((h, i) => {
          const c = row.getCell(i + 1);
          c.value = h;
          c.fill = headerFill;
          c.font = headerFont;
          c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          c.border = { top: thin, left: thin, right: thin, bottom: thin };
        });
      };

      const summary = workbook.addWorksheet("Summary");
      summary.columns = [{ width: 18 }, { width: 30 }, { width: 45 }, { width: 45 }, { width: 24 }];
      summary.mergeCells("A1:E1");
      summary.getCell("A1").value = "THỐNG KÊ CASE SUPPORT";
      summary.getCell("A1").font = { bold: true, size: 16 };
      summary.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
      makeHeader(summary.getRow(4), ["Ngày", "1. Tình trạng", "2. Phương án xử lý", "3. Kết quả", "4. Người thực hiện"]);
      rows.forEach((r, i) => {
        const row = summary.getRow(5 + i);
        row.getCell(1).value = formatTicketDate(r);
        row.getCell(2).value = normalizePlainText(r?.tinhTrang);
        row.getCell(3).value = r?.phuongAnXuLyHtml ? htmlToText(r.phuongAnXuLyHtml) : normalizePlainText(r?.phuongAnXuLy);
        row.getCell(4).value = r?.ketQuaHtml ? htmlToText(r.ketQuaHtml) : normalizePlainText(r?.ketQua);
        row.getCell(5).value = resolvePerformerName(r?.nguoiThucHien);
        for (let c = 1; c <= 5; c++) {
          row.getCell(c).alignment = { vertical: "top", horizontal: c === 1 ? "center" : "left", wrapText: true };
          row.getCell(c).border = { top: thin, left: thin, right: thin, bottom: thin };
        }
      });

      const perfSheet = workbook.addWorksheet("By Performer");
      perfSheet.columns = [{ width: 30 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }];
      makeHeader(perfSheet.getRow(1), ["Người thực hiện", "Tổng", "Hoàn tất", "Đang xử lý", "Đã in", "Chưa in"]);
      Array.from(byPerformer.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total)
        .forEach((it, idx) => {
          perfSheet.addRow([it.name, it.total, it.completed, it.pending, it.printed, it.unprinted]);
          const row = perfSheet.getRow(2 + idx);
          for (let c = 1; c <= 6; c++) row.getCell(c).border = { top: thin, left: thin, right: thin, bottom: thin };
        });

      const companySheet = workbook.addWorksheet("By Company");
      companySheet.columns = [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }];
      makeHeader(companySheet.getRow(1), ["Công ty", "Tổng", "Hoàn tất", "Đang xử lý", "Đã in", "Chưa in"]);
      Array.from(byCompany.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total)
        .forEach((it, idx) => {
          companySheet.addRow([it.name, it.total, it.completed, it.pending, it.printed, it.unprinted]);
          const row = companySheet.getRow(2 + idx);
          for (let c = 1; c <= 6; c++) row.getCell(c).border = { top: thin, left: thin, right: thin, bottom: thin };
        });

      const detail = workbook.addWorksheet("Detail");
      detail.columns = [
        { width: 16 }, { width: 14 }, { width: 24 }, { width: 20 }, { width: 18 }, { width: 20 }, { width: 28 },
        { width: 12 }, { width: 28 }, { width: 36 }, { width: 32 }, { width: 12 }, { width: 14 },
      ];
      makeHeader(detail.getRow(1), [
        "Số phiếu", "Ngày", "Khách hàng", "Người thực hiện", "Người liên hệ", "SĐT / Email", "Địa chỉ",
        "Phí dịch vụ", "Tình trạng", "Phương án xử lý", "Kết quả", "Trạng thái in", "Trạng thái phiếu",
      ]);
      rows.forEach((r) => {
        detail.addRow([
          safeString(r?.soPhieu),
          formatTicketDate(r),
          safeString(r?.khachHang),
          resolvePerformerName(r?.nguoiThucHien),
          safeString(r?.nguoiLienHe),
          safeString(r?.phone),
          safeString(r?.diaChi),
          safeString(r?.phiDichVu),
          normalizePlainText(r?.tinhTrang),
          r?.phuongAnXuLyHtml ? htmlToText(r.phuongAnXuLyHtml) : normalizePlainText(r?.phuongAnXuLy),
          r?.ketQuaHtml ? htmlToText(r.ketQuaHtml) : normalizePlainText(r?.ketQua),
          toBoolean(r?.printed) ? "Đã in" : "Chưa in",
          normalizeStatus(r?.status),
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ThongKe_CaseSupport_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success("Đã xuất Excel thống kê");
    } catch (e) {
      message.error(e?.message || "Không thể xuất Excel thống kê");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleOpenEditHistory = async (record, statusOverride) => {
    let editRecord = record;
    const recordId = String(record?._id || record?.id || record?.soPhieu || "").trim();

    const missingHeavyFields =
      editRecord?.phuongAnXuLyHtml === undefined ||
      editRecord?.ketQuaHtml === undefined ||
      editRecord?.phuongAnXuLy === undefined ||
      editRecord?.ketQua === undefined;

    if (recordId && missingHeavyFields) {
      try {
        const fullRecord = await Api.getHistoryById(recordId);
        if (fullRecord) {
          editRecord = { ...editRecord, ...fullRecord };
        }
      } catch (e) {
        // Nếu không load được dữ liệu đầy đủ, vẫn mở form với dữ liệu hiện tại.
      }
    }

    setHistoryEditRecord(editRecord);
    const parsedNgay = editRecord?.ngay
      ? dayjs(editRecord.ngay, "DD/MM/YYYY")
      : editRecord?.createdAt
        ? dayjs(editRecord.createdAt)
        : null;

    historyEditForm.setFieldsValue({
      soPhieu: editRecord?.soPhieu || "",
      ngay: parsedNgay,
      khachHang: editRecord?.khachHang || "",
      nguoiLienHe: editRecord?.nguoiLienHe || "",
      phone: editRecord?.phone || "",
      diaChi: editRecord?.diaChi || "",
      nguoiThucHien: editRecord?.nguoiThucHien || "",
      phiDichVu: editRecord?.phiDichVu || "0",
      rating: editRecord?.rating === "" ? undefined : editRecord?.rating ?? undefined,
      status: statusOverride !== undefined ? statusOverride : editRecord?.status ?? undefined,
      loaiPhieu: editRecord?.loaiPhieu || "incident",
      tinhTrang: editRecord?.tinhTrang || "",
      phuongAnXuLy: editRecord?.phuongAnXuLy || "",
      phuongAnXuLyHtml: editRecord?.phuongAnXuLyHtml || editRecord?.phuongAnXuLy || "",
      ketQua: editRecord?.ketQua || "",
      ketQuaHtml: editRecord?.ketQuaHtml || editRecord?.ketQua || "",
    });
  };

  const handleSaveEditHistory = async (vals) => {
    const id = historyEditRecord?._id || historyEditRecord?.id || historyEditRecord?.soPhieu;
    if (!id) {
      message.error("Không tìm thấy ID bản ghi");
      return;
    }

    const currentPhuongAnXuLyHtml = getCkEditorHtmlValue("phuongAnXuLy");
    const currentKetQuaHtml = getCkEditorHtmlValue("ketQua");

    try {
      await Api.updateHistory(String(id), {
        currentUser: String(user?.key || user?.username || "").trim(),
        updatedBy: String(user?.key || user?.username || "").trim(),
        soPhieu: vals.soPhieu || historyEditRecord?.soPhieu,
        ngay: vals.ngay ? dayjs(vals.ngay).format("DD/MM/YYYY") : historyEditRecord?.ngay,
        khachHang: vals.khachHang || historyEditRecord?.khachHang,
        nguoiThucHien: vals.nguoiThucHien || historyEditRecord?.nguoiThucHien,
        nguoiLienHe: vals.nguoiLienHe || historyEditRecord?.nguoiLienHe,
        phone: vals.phone || historyEditRecord?.phone,
        diaChi: vals.diaChi || historyEditRecord?.diaChi,
        phiDichVu: vals.phiDichVu || historyEditRecord?.phiDichVu,
        tinhTrang: vals.tinhTrang || "",
        phuongAnXuLy: vals.phuongAnXuLy || historyEditRecord?.phuongAnXuLy || "",
        phuongAnXuLyHtml:
          currentPhuongAnXuLyHtml !== undefined
            ? currentPhuongAnXuLyHtml
            : vals.phuongAnXuLyHtml !== undefined
              ? vals.phuongAnXuLyHtml
              : historyEditRecord?.phuongAnXuLyHtml,
        ketQua: vals.ketQua || historyEditRecord?.ketQua || "",
        ketQuaHtml:
          currentKetQuaHtml !== undefined
            ? currentKetQuaHtml
            : vals.ketQuaHtml !== undefined
              ? vals.ketQuaHtml
              : historyEditRecord?.ketQuaHtml,
        rating:
          vals.rating === "" || vals.rating === undefined || vals.rating === null
            ? historyEditRecord?.rating
            : Number(vals.rating),
        status: vals.status !== undefined && vals.status !== null ? vals.status : historyEditRecord?.status,
        loaiPhieu: vals.loaiPhieu !== undefined && vals.loaiPhieu !== null ? vals.loaiPhieu : historyEditRecord?.loaiPhieu,
      });
      message.success("Đã cập nhật phiếu");
      setHistoryEditRecord(null);
      historyEditForm.resetFields();
      await loadHistory({ page: filters.page || 1 });
    } catch (e) {
      message.error(e?.message || "Lỗi cập nhật phiếu");
    }
  };

  const handleDeleteHistory = async (id, soPhieu) => {
    if (!id) {
      message.error("Không tìm thấy ID bản ghi");
      return;
    }
    confirmDelete("Xóa lịch sử", `Bạn có chắc chắn muốn xóa phiếu ${soPhieu || id}?`, async () => {
      try {
        await Api.deleteHistory(String(id));
        message.success("Đã xóa bản ghi");
        setSelectedRowKeys((prev) => (prev || []).filter((k) => k !== String(id)));
        await loadHistory({ page: filters.page || 1 });
      } catch (e) {
        message.error(e?.message || "Lỗi xóa bản ghi");
      }
    });
  };

  const printPreviewHtml = async ({ htmlBody, cssText, title, multiPage = false }) => {
    return new Promise((resolve, reject) => {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.style.opacity = "0";
        iframe.style.border = "0";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          iframe.remove();
          reject(new Error("Không thể khởi tạo vùng in"));
      return;
    }

        const runtimeStyles = Array.from(
          document.querySelectorAll('link[rel="stylesheet"], style')
        )
          .map((el) => el.outerHTML)
          .join("\n");

        const html = `<!doctype html>
          <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <base href="${window.location.origin}/" />
    <title>${String(title || "")}</title>
    ${runtimeStyles}
    <style>${cssText || ""}</style>
    <style>
      html, body {
        width: 210mm !important;
        min-width: 210mm !important;
        height: ${multiPage ? "auto" : "297mm"} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        overflow: visible !important;
      }
      #print-root {
        width: 210mm !important;
        min-width: 210mm !important;
        height: auto !important;
        overflow: visible !important;
      }
      .print-container {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: ${multiPage ? "auto" : "210mm"} !important;
        margin: 0 auto !important;
        padding: 0 !important;
        left: auto !important;
        top: auto !important;
      }
      #print-root {
        display: block !important;
        width: 100% !important;
      }
      .preview-wrapper-modal {
        display: flex !important;
        justify-content: center !important;
        align-items: flex-start !important;
        padding: 0 !important;
        height: auto !important;
        width: 100% !important;
      }
      .print-page {
        width: 210mm !important;
        min-height: 297mm !important;
        max-width: 210mm !important;
        padding: 12mm !important;
        margin: 0 auto !important;
        box-sizing: border-box !important;
        transform: none !important;
        zoom: 1 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .batch-print-item {
        display: block !important;
        width: 210mm !important;
        min-height: 297mm !important;
        margin: 0 auto !important;
        page-break-after: always;
        break-after: page;
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
      }
      .batch-print-item:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .batch-print-item .print-page {
        width: 210mm !important;
        min-height: 297mm !important;
        max-width: 210mm !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      /* Ensure all content is visible in print area */
      .print-page,
      .print-page *,
      .print-container,
      .print-container *,
      #print-root,
      #print-root * {
        visibility: visible !important;
        opacity: 1 !important;
        overflow: visible !important;
      }
      .batch-print-item:last-child .print-page {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      @page { size: A4 portrait; margin: 0 !important; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        #print-root { display: block !important; visibility: visible !important; }
        .print-container { display: block !important; visibility: visible !important; }
        .print-page {
          width: 210mm !important;
          min-height: 297mm !important;
          max-width: 210mm !important;
          padding: 12mm !important;
          margin: 0 auto !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-container"><div id="print-root">${htmlBody || ""}</div></div>
            </body>
</html>`;

        let didPrint = false;
        const runPrint = () => {
          if (didPrint) return;
          didPrint = true;
          try {
            const w = iframe.contentWindow;
            if (!w) throw new Error("Không thể truy cập cửa sổ in");
            const finish = () => {
              resolve(true);
              setTimeout(() => {
                try {
                  iframe.remove();
                } catch (e) {}
              }, 500);
            };
            const onFocusBack = () => {
              window.removeEventListener("focus", onFocusBack);
              finish();
            };
            window.addEventListener("focus", onFocusBack, { once: true });
            w.focus();
            w.print();
            // Fallback in case browser doesn't fire focus event as expected.
            setTimeout(() => {
              window.removeEventListener("focus", onFocusBack);
              finish();
            }, 1800);
          } catch (err) {
            reject(err);
          }
        };

        const waitForPrintReady = () => {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            setTimeout(waitForPrintReady, 50);
            return;
          }
          
          // Check if document is fully loaded and print-root element exists with content
          const printRoot = iframeDoc.querySelector("#print-root");
          const bodyReady = iframeDoc.readyState === "complete" || iframeDoc.readyState === "interactive";
          const contentReady = printRoot && printRoot.innerHTML && printRoot.innerHTML.trim().length > 0;
          
          if (bodyReady && contentReady) {
            // Give browser extra time to render all styles
            setTimeout(runPrint, 300);
          } else {
            setTimeout(waitForPrintReady, 50);
          }
        };

        iframe.onload = () => waitForPrintReady();
        doc.open();
        doc.write(html);
        doc.close();
        
        // Fallback: start waiting immediately if onload doesn't trigger
        setTimeout(waitForPrintReady, 150);
      } catch (err) {
        reject(err);
      }
    });
  };

  const handlePrintHistoryRecord = async (record, opts = {}) => {
    const {
      reloadAfter = true,
      silent = false,
      propagateError = false,
    } = opts;
    const id = record?._id || record?.id || record?.soPhieu;
    if (!id) {
      if (!silent) message.error("Không tìm thấy ID bản ghi");
      return;
    }

    try {
      // Print using the exact Preview markup + index.css (desktop-like)
      let cssText = "";
      try {
        const res = await fetch("/index.css", { cache: "no-store" });
        if (res.ok) cssText = await res.text();
      } catch (e) {}

      const translatedRecord = await maybeTranslateTicketData(record || {});
      const performerUser = getPerformerUser(translatedRecord.nguoiThucHien || record?.nguoiThucHien);
      const performerId = performerUser ? String(performerUser?.id || performerUser?._id || "").trim() : "";
      const signature = performerId ? await Api.getSignature(performerId) : null;
      const resolvedRecord = {
        ...translatedRecord,
        nguoiThucHien: resolvePerformerName(translatedRecord.nguoiThucHien || record?.nguoiThucHien),
        userSignatureDataUrl: signature?.signatureDataUrl,
      };
      const htmlBody = renderToStaticMarkup(
        <Preview data={resolvedRecord || {}} config={cfg} translations={translations} />
      );
      const printed = await printPreviewHtml({
        htmlBody,
        cssText,
        title: `Phiếu ${String(record?.soPhieu || "")}`,
      });
      if (!printed) return false;

      await Api.updateHistory(String(id), {
        printed: true,
        nguoiInPhieu: resolvePerformerName(record?.nguoiThucHien || record?.nguoiInPhieu),
      });
      if (!silent) message.success("Đã cập nhật trạng thái in");

      if (reloadAfter) {
      await loadHistory({ page: filters.page || 1 });
      }
      return true;
    } catch (e) {
      if (!silent) message.error(e?.message || "Không thể in phiếu");
      if (propagateError) throw e;
      return false;
    }
  };

  const handlePrintSelected = async () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một bản ghi để in");
      return;
    }
    setConfirmPrintModalVisible(true);
  };

  const handleConfirmPrintSelected = async () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một bản ghi để in");
      return;
    }

    setConfirmPrintModalVisible(false);
    setProgressModalVisible(true);
    printCancelledRef.current = false;
    setPrintProgress({ current: 0, total: selectedRowKeys.length, success: [], failed: [] });

    let localSuccess = 0;
    let localFailed = 0;
    const successSoPhieu = [];
    const failedSoPhieu = [];

    try {
      const rows = await Api.getHistoryByIds(selectedRowKeys.map(String));
      const list = Array.isArray(rows) ? rows : [];

      setSelectedRowKeys([]);
      setPrintProgress({ current: 0, total: list.length, success: [], failed: [] });

      // Print batch in a single browser print dialog.
      let cssText = "";
      try {
        const res = await fetch("/index.css", { cache: "no-store" });
        if (res.ok) cssText = await res.text();
      } catch (e) {}

      const translatedList = [];
      for (let i = 0; i < list.length; i++) {
        const row = list[i];
        // eslint-disable-next-line no-await-in-loop
        const translatedRow = await maybeTranslateTicketData(row || {});
        const performerUser = getPerformerUser((translatedRow || row)?.nguoiThucHien);
        const performerId = performerUser ? String(performerUser?.id || performerUser?._id || "").trim() : "";
        const signature = performerId ? await Api.getSignature(performerId) : null;
        const resolvedRow = {
          ...(translatedRow || row || {}),
          nguoiThucHien: resolvePerformerName((translatedRow || row)?.nguoiThucHien),
          userSignatureDataUrl: signature?.signatureDataUrl,
        };
        translatedList.push(resolvedRow);
      }

      const htmlBody = translatedList
        .map((row, idx) => {
          const previewHtml = renderToStaticMarkup(
            <Preview data={row || {}} config={cfg} translations={translations} />
          );
          return `<div class="batch-print-item">${previewHtml}</div>`;
        })
        .join("");

      const printed = await printPreviewHtml({
        htmlBody,
        cssText,
        title: `In hàng loạt (${translatedList.length} phiếu)`,
        multiPage: true,
      });
      if (!printed) {
        setProgressModalVisible(false);
        message.info("Đã hủy in hàng loạt");
        return;
      }

      for (let i = 0; i < list.length; i++) {
        if (printCancelledRef.current) break;

        const row = list[i];
        const soPhieu = row?.soPhieu || row?.id || row?._id || `#${i + 1}`;
        try {
          const id = row?._id || row?.id || row?.soPhieu;
          if (!id) throw new Error("Không tìm thấy ID bản ghi");
          // eslint-disable-next-line no-await-in-loop
          await Api.updateHistory(String(id), {
            printed: true,
            nguoiInPhieu: resolvePerformerName(row?.nguoiThucHien || row?.nguoiInPhieu),
          });
          localSuccess += 1;
          successSoPhieu.push(soPhieu);
          setPrintProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            success: [...successSoPhieu],
          }));
        } catch (e) {
          localFailed += 1;
          const reason = e?.message || "In thất bại";
          failedSoPhieu.push({ soPhieu, reason });
          setPrintProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            failed: [...failedSoPhieu],
          }));
        }
      }

      await loadHistory({ page: filters.page || 1 });

      // Check if batch was cancelled
      if (printCancelledRef.current) {
        // Cancelled - show cancellation message instead of success
        message.warning("Đã hủy in hàng loạt");
      } else {
        // Not cancelled - show regular results
        if (localSuccess > 0 && localFailed === 0) {
          // All successful
          message.success(`Đã in thành công ${localSuccess} phiếu`);
        } else if (localSuccess > 0 && localFailed > 0) {
          // Mixed success and failure
          message.warning(`In thành công ${localSuccess} phiếu, thất bại ${localFailed} phiếu`);
        } else if (localFailed > 0) {
          // All failed
          message.error(`In thất bại ${localFailed} phiếu`);
        } else {
          // No items processed
          message.info("Không có phiếu nào được xử lý");
        }
      }
    } catch (e) {
      if (!printCancelledRef.current) {
        message.error(e?.message || "Không thể in hàng loạt");
      }
    }
  };

  const handleCancelBatchPrint = () => {
    printCancelledRef.current = true;
    setTimeout(() => {
      setProgressModalVisible(false);
    }, 500);
  };

  const handleDownloadHistoryRecord = async (record) => {
    try {
      setDownloadingPdf(true);
      // Align desktop flow (Riêng biệt backend/frontend/index.html: 892-961)
      if (window.electronAPI && typeof window.electronAPI.exportTicket === "function") {
        const previewDataRaw = {
          _id: record?._id || record?.id,
          id: record?._id || record?.id,
          soPhieu: record?.soPhieu,
          ngay: record?.ngay || "",
          khachHang: record?.khachHang,
          diaChi: record?.diaChi,
          nguoiThucHien: resolvePerformerName(record?.nguoiThucHien),
          nguoiLienHe: record?.nguoiLienHe,
          phiDichVu: record?.phiDichVu || "0",
          tinhTrang: record?.tinhTrang || "",
          phuongAnXuLy: record?.phuongAnXuLy || record?.phuongAnXuLyHtml || "",
          phuongAnXuLyHtml: record?.phuongAnXuLyHtml || record?.phuongAnXuLy || "",
          ketQua: record?.ketQua || record?.ketQuaHtml || "",
          ketQuaHtml: record?.ketQuaHtml || record?.ketQua || "",
          rating: record?.rating || "",
          printed: record?.printed || false,
          printedAt: record?.printedAt || null,
        };
        
        // Load user signature
        try {
          const userId = String(user?.id || user?._id || "").trim();
          const sig = await Api.getCurrentUserSignature(userId);
          if (sig?.signatureDataUrl) {
            previewDataRaw.userSignatureDataUrl = sig.signatureDataUrl;
          }
        } catch (e) {
          // Signature not available, that's ok
        }
        
        const previewData = await maybeTranslateTicketData(previewDataRaw);

        const hide = message.loading("Đang tạo file PDF...", 0);
        let cssText = "";
        try {
          const cssRes = await fetch("/index.css", { cache: "no-store" });
          if (cssRes && cssRes.ok) cssText = await cssRes.text();
        } catch (e) {}

        const mount = document.createElement("div");
        mount.style.position = "fixed";
        mount.style.left = "-100000px";
        mount.style.top = "-100000px";
        mount.style.width = "900px";
        mount.style.background = "#fff";
        document.body.appendChild(mount);

        try {
          mount.innerHTML = `<style>${cssText || ""}</style>${renderToStaticMarkup(
            <Preview data={previewData} config={cfg} translations={translations} />
          )}`;
          await new Promise((r) => setTimeout(r, 120));
          const printEl = mount.querySelector("#print-area");
          const ticketHtml = printEl ? printEl.outerHTML : mount.innerHTML;
          const fullHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>${cssText || ""}</style>
  </head>
  <body>
    ${ticketHtml || mount.innerHTML || ""}
  </body>
</html>`;
          const suggestedName = `Phieu_${String(previewData.soPhieu || "ticket")}`;
          const res = await window.electronAPI.exportTicket({
            format: "pdf",
            ticketHtml: ticketHtml || "",
            html: fullHtml,
            suggestedName,
          });

          hide();
          if (res && res.ok) message.success("Đã tải xuống phiếu");
          else if (res && res.cancelled) message.info("Đã hủy tải xuống");
          else message.error((res && res.message) || "Không thể tải xuống phiếu");
        } finally {
          try {
            mount.remove();
          } catch (e) {}
        }
        return;
      }

      // Fallback for browser-only mode (no electron API)
      const soPhieu = String(record?.soPhieu || record?._id || record?.id || "ticket");
      const fileName = `Phieu_${soPhieu}`.replace(/[^a-z0-9-_]/gi, "_");
      let cssText = "";
      try {
        const cssRes = await fetch("/index.css", { cache: "no-store" });
        if (cssRes.ok) cssText = await cssRes.text();
      } catch (e) {}
      const translatedRecordTemp = await maybeTranslateTicketData(record || {});
      const translatedRecord = {
        ...translatedRecordTemp,
        nguoiThucHien: resolvePerformerName(translatedRecordTemp.nguoiThucHien || record?.nguoiThucHien),
      };
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "210mm";
      host.style.background = "#fff";
      host.innerHTML = `<style>${cssText || ""}</style>${renderToStaticMarkup(
        <Preview data={translatedRecord || {}} config={cfg} translations={translations} />
      )}`;
      document.body.appendChild(host);
      try {
        const html2canvasMod = await import("html2canvas");
        const html2canvas = html2canvasMod?.default || html2canvasMod;
        const printEl = host.querySelector("#print-area") || host.firstElementChild || host;
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        await new Promise((r) => requestAnimationFrame(() => r()));
        await new Promise((r) => requestAnimationFrame(() => r()));
        const canvas = await html2canvas(printEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: Math.max(printEl.scrollWidth || 794, 794),
          windowHeight: Math.max(printEl.scrollHeight || 1123, 1123),
          scrollX: 0,
          scrollY: 0,
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const imgW = canvas.width * ratio;
        const imgH = canvas.height * ratio;
        const offsetX = (pageW - imgW) / 2;
        const offsetY = (pageH - imgH) / 2;
        doc.addImage(imgData, "PNG", offsetX, offsetY, imgW, imgH, undefined, "FAST");
      doc.save(`${fileName}.pdf`);
      message.success("Đã tải xuống PDF");
      } finally {
        document.body.removeChild(host);
      }
    } catch (e) {
      message.error(e?.message || "Không thể tải xuống");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrintCurrentForm = async () => {
    try {
      if (savingTicket || printingTicket) return;
      setPrintingTicket(true);
      // Print should not block on "Khách hàng" selection (desktop behavior).
      // We only validate the minimum fields needed for printing.
      await form.validateFields(["ngay", "tinhTrang", "phuongAnXuLy", "ketQua"]);
      const vals = form.getFieldsValue(true);
      const ensuredSoPhieu = await ensureFormSoPhieu();
      const phuongAnXuLyHtmlValue =
        vals.phuongAnXuLyHtml || getCkEditorHtmlValue("phuongAnXuLy") || vals.phuongAnXuLy || "";
      const ketQuaHtmlValue =
        vals.ketQuaHtml || getCkEditorHtmlValue("ketQua") || vals.ketQua || "";

      const payload = {
        ...vals,
        soPhieu: vals.soPhieu || ensuredSoPhieu || "",
        rating: vals.rating !== undefined && vals.rating !== null ? vals.rating : "",
        ngay: vals.ngay ? dayjs(vals.ngay).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"),
        phuongAnXuLy: phuongAnXuLyHtmlValue,
        phuongAnXuLyHtml: phuongAnXuLyHtmlValue,
        ketQua: ketQuaHtmlValue,
        ketQuaHtml: ketQuaHtmlValue,
      };

      // Create record first, then mark printed and open print window
      const res = await Api.createHistoryWithTicket(payload);

      let cssText = "";
      try {
        const cssRes = await fetch("/index.css", { cache: "no-store" });
        if (cssRes.ok) cssText = await cssRes.text();
      } catch (e) {}

      const printRecord = { ...(payload || {}), ...(res || {}), nguoiThucHien: resolvePerformerName((res?.nguoiThucHien || payload.nguoiThucHien || performerDisplayName)) };
      const translatedRecord = await maybeTranslateTicketData(printRecord);
      const resolvedPrintRecord = {
        ...translatedRecord,
        nguoiThucHien: resolvePerformerName(translatedRecord.nguoiThucHien || printRecord.nguoiThucHien),
      };
      const htmlBody = renderToStaticMarkup(
        <Preview data={resolvedPrintRecord || printRecord} config={cfg} translations={translations} />
      );
      const printed = await printPreviewHtml({
        htmlBody,
        cssText,
        title: `Phiếu ${String(res?.soPhieu || "")}`,
      });
      if (!printed) return;

      const id = res?._id || res?.id || res?.soPhieu;
      if (id) {
        await Api.updateHistory(String(id), {
          printed: true,
          nguoiInPhieu: vals.nguoiThucHien || "",
        });
      }
      setFormPrintPreviewOpen(false);
      message.success(`Đã in phiếu ${res?.soPhieu || ""}`.trim());
      await loadHistory({ page: 1 });
      form.resetFields();
      setFormResetKey(Date.now());
      setTinhTrangFilteredOptions([]);
      setTinhTrangSearchValue("");

    } catch (e) {
      message.error(e?.message || "Không thể in phiếu");
    } finally {
      setPrintingTicket(false);
    }
  };

  const handlePrintCurrentFormRef = useRef(null);
  useEffect(() => {
    handlePrintCurrentFormRef.current = handlePrintCurrentForm;
  });

  useEffect(() => {
    if (typeof setFormPrintPreviewPrintAction === "function") {
      setFormPrintPreviewPrintAction(() => async () => {
        const fn = handlePrintCurrentFormRef.current;
        if (typeof fn === "function") return await fn();
      });
      return () => setFormPrintPreviewPrintAction(null);
    }
    return undefined;
  }, [setFormPrintPreviewPrintAction]);

  const openFormPrintPreview = async () => {
    setFormPrintPreviewLoading(true);
    setFormPrintPreviewData(null);
    setFormPrintPreviewOpen(true);

    try {
      const ensuredSoPhieu = await ensureFormSoPhieu();
      const vals = form.getFieldsValue(true);
      const soPhieu = String(vals.soPhieu || ensuredSoPhieu || "").trim();
      if (soPhieu && soPhieu !== String(vals.soPhieu || "").trim()) {
        form.setFieldsValue({ soPhieu });
      }
      const payloadRaw = {
        ...vals,
        soPhieu,
        rating: vals.rating !== undefined && vals.rating !== null ? vals.rating : "",
        ngay: vals.ngay ? dayjs(vals.ngay).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"),
        phuongAnXuLyHtml: vals.phuongAnXuLyHtml || vals.phuongAnXuLy || "",
        ketQuaHtml: vals.ketQuaHtml || vals.ketQua || "",
      };
      
      // Load user signature
      try {
        const userId = String(user?.id || user?._id || "").trim();
        const sig = await Api.getCurrentUserSignature(userId);
        if (sig?.signatureDataUrl) {
          payloadRaw.userSignatureDataUrl = sig.signatureDataUrl;
        }
      } catch (e) {
        // Signature not available, that's ok
      }
      
      const payload = await maybeTranslateTicketData(payloadRaw);
      setFormPrintPreviewData(payload);
    } catch (e) {
      message.error(e?.message || "Không thể mở xem trước in");
      setFormPrintPreviewOpen(false);
    } finally {
      setFormPrintPreviewLoading(false);
    }
  };

  useEffect(() => {
    const openFromNotification = async () => {
      const notification = pendingNotificationPreview;
      if (!notification) return;

      const ticketId = String(notification?.ticketId || "").trim();
      const soPhieu = String(notification?.soPhieu || "").trim();
      if (!ticketId && !soPhieu) {
        clearPendingNotificationPreview?.();
        return;
      }

      setFormPrintPreviewLoading(true);
      setFormPrintPreviewData(null);
      setFormPrintPreviewOpen(true);

      let record = null;
      try {
        if (ticketId) {
          record = await Api.getHistoryById(ticketId);
        }
        if (!record && soPhieu) {
          const res = await Api.searchHistory({ keyword: soPhieu, page: 1, pageSize: 1 });
          const rows = Array.isArray(res?.data) ? res.data : [];
          record = rows.find((r) => String(r?.soPhieu || "").trim() === soPhieu) || rows[0] || null;
        }
        if (!record) {
          message.warning("Không tìm thấy phiếu cho thông báo này");
          setFormPrintPreviewOpen(false);
          return;
        }

        const recordId = String(record?._id || record?.id || "").trim();
        if (recordId) {
          try {
            const fullRecord = await Api.getHistoryById(recordId);
            if (fullRecord) record = { ...record, ...fullRecord };
          } catch (e) {
            // Keep fallback record if detail fetch fails.
          }
        }

        const translatedRecordRaw = await maybeTranslateTicketData(record || {});
        const translatedRecord = {
          ...translatedRecordRaw,
          nguoiThucHien: resolvePerformerName(
            translatedRecordRaw?.nguoiThucHien || record?.nguoiThucHien
          ),
        };

        setFormPrintPreviewOpen(true);
        setFormPrintPreviewData(translatedRecord);
      } catch (e) {
        message.error(e?.message || "Không thể mở xem trước in");
        setFormPrintPreviewOpen(false);
      } finally {
        setFormPrintPreviewLoading(false);
        clearPendingNotificationPreview?.();
      }
    };

    openFromNotification();
  }, [
    clearPendingNotificationPreview,
    message,
    maybeTranslateTicketData,
    pendingNotificationPreview,
    resolvePerformerName,
    setFormPrintPreviewData,
    setFormPrintPreviewLoading,
    setFormPrintPreviewOpen,
  ]);

  useEffect(() => {
    if (!formPrintPreviewOpen) {
      setFormPrintPreviewLoading(false);
    }
  }, [formPrintPreviewOpen, setFormPrintPreviewLoading]);

  const handleDownloadFormPreviewPDF = async () => {
    try {
      setDownloadingPdf(true);
      const soPhieu = String(formPrintPreviewData?.soPhieu || "ticket");
      const fileName = `Phieu_${soPhieu}`.replace(/[^a-z0-9-_]/gi, "_");
      
      let cssText = "";
      try {
        const cssRes = await fetch("/index.css", { cache: "no-store" });
        if (cssRes.ok) cssText = await cssRes.text();
      } catch (e) {}
      
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "210mm";
      host.style.background = "#fff";
      host.innerHTML = `<style>${cssText || ""}</style>${renderToStaticMarkup(
        <Preview data={formPrintPreviewData || {}} config={cfg} translations={translations} />
      )}`;
      document.body.appendChild(host);
      
      try {
        const html2canvasMod = await import("html2canvas");
        const html2canvas = html2canvasMod?.default || html2canvasMod;
        const printEl = host.querySelector("#print-area") || host.firstElementChild || host;
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        
        await new Promise((r) => requestAnimationFrame(() => r()));
        await new Promise((r) => requestAnimationFrame(() => r()));
        
        const canvas = await html2canvas(printEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: Math.max(printEl.scrollWidth || 794, 794),
          windowHeight: Math.max(printEl.scrollHeight || 1123, 1123),
          scrollX: 0,
          scrollY: 0,
          logging: false,
        });
        
        const imgData = canvas.toDataURL("image/png");
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
        const imgW = canvas.width * ratio;
        const imgH = canvas.height * ratio;
        const offsetX = (pageW - imgW) / 2;
        const offsetY = (pageH - imgH) / 2;
        
        doc.addImage(imgData, "PNG", offsetX, offsetY, imgW, imgH, undefined, "FAST");
        doc.save(`${fileName}.pdf`);
        message.success("Đã tải xuống PDF");
      } finally {
        document.body.removeChild(host);
      }
    } catch (e) {
      message.error(e?.message || "Không thể tải xuống PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // connect socket once (and reconnect if backendUrl changes via reload)
    const s = connectSocket();
    s.on("history:new", () => loadHistory({ page: 1 }));
    s.on("history:update", () => loadHistory({ page: filtersRef.current.page || 1 }));
    s.on("history:delete", () => loadHistory({ page: filtersRef.current.page || 1 }));
    s.on("customer:new", loadCustomers);
    s.on("customer:update", loadCustomers);
    s.on("customer:delete", loadCustomers);
    s.on("user:created", loadUsers);
    s.on("user:updated", (data) => {
      loadUsers();
      // Realtime filter update: if current user's savedHistoryFilters changed
      if (data?.isFilterUpdate) {
        const currentUserId = String(user?.id || user?._id || "").trim();
        const currentUserKey = String(user?.key || "").trim();
        const updatedUserId = String(data?.id || data?._id || "").trim();
        const updatedUserKey = String(data?.key || "").trim();
        const isSameUser = (currentUserId && updatedUserId && currentUserId === updatedUserId) ||
                           (currentUserKey && updatedUserKey && currentUserKey === updatedUserKey);
        if (isSameUser && data?.savedHistoryFilters) {
          setAuthUser((prev) => ({
            ...(prev || {}),
            ...(data || {}),
          }));
        }
      }
    });
    s.on("user:deleted", loadUsers);
    
    // Listen to user online/offline status
    s.on("user:online", (data) => {
      const userId = data?.userId || data?.id;
      const userKey = data?.key;
      if (userId) {
        setUserStatus(prev => ({ 
          ...prev, 
          [String(userId).trim()]: "online",
          ...(userKey ? { [String(userKey).trim()]: "online" } : {})
        }));
        console.log(`[Socket] ${data?.username || userId} is now ONLINE`);
      }
    });
    s.on("user:offline", (data) => {
      const userId = data?.userId || data?.id;
      const userKey = data?.key;
      if (userId) {
        setUserStatus(prev => ({ 
          ...prev, 
          [String(userId).trim()]: "offline",
          ...(userKey ? { [String(userKey).trim()]: "offline" } : {})
        }));
        console.log(`[Socket] ${data?.username || userId} is now OFFLINE`);
      }
    });
    s.on("user:status:update", (data) => {
      if (data && typeof data === "object") {
        const normalized = {};
        Object.entries(data).forEach(([key, value]) => {
          normalized[String(key).trim()] = value;
        });
        setUserStatus(prev => ({ ...prev, ...normalized }));
      }
    });

    // Listen to suggestions update for realtime autocomplete
    s.on("suggestions:update", (data) => {
      if (data?.field === "tinhTrang" && Array.isArray(data?.suggestions)) {
        setTinhTrangSuggestions(data.suggestions);
        console.log("[Socket] tinhTrang suggestions updated realtime");
      }
    });
    s.on("ticket:assigned", (data) => {
      const myKey = String(user?.key || user?.username || "").trim().toLowerCase();
      const assignedTo = String(data?.assignedTo || "").trim().toLowerCase();
      if (!myKey || (assignedTo && assignedTo !== myKey)) return;
      const title = data?.soPhieu
        ? `Bạn được giao phiếu ${data.soPhieu}`
        : "Bạn được giao 1 phiếu";
      const message = data?.soPhieu
        ? `Bạn được giao phiếu ${data.soPhieu} bởi ${data?.assignedByName || data?.assignedBy || "Ai đó"}`
        : `Bạn được giao 1 phiếu bởi ${data?.assignedByName || data?.assignedBy || "Ai đó"}`;
      pushAssignmentNotification?.({
        notificationId: data?.notificationId,
        type: "ticket-assigned",
        title,
        message,
        ticketId: data?.ticketId,
        soPhieu: data?.soPhieu,
        assignedBy: data?.assignedBy,
        assignedByName: data?.assignedByName,
        status: data?.status,
        timestamp: data?.timestamp,
      });
    });
    s.on("ticket:followed-update", (data) => {
      pushAssignmentNotification?.({
        notificationId: data?.notificationId,
        type: "ticket-followed-update",
        title: "Phiếu bạn theo dõi đã thay đổi",
        message: `${data?.actorName || "Ai đó"} đã thay đổi phiếu ${data?.soPhieu || ""}`,
        ticketId: data?.ticketId,
        soPhieu: data?.soPhieu,
        actorName: data?.actorName,
        status: data?.status,
        timestamp: data?.timestamp,
      });
    });
    s.on("ticket:followed", (data) => {
      pushAssignmentNotification?.({
        notificationId: data?.notificationId,
        type: "ticket-followed",
        title: data?.soPhieu
          ? `${data?.actorName || "Ai đó"} đã gắn bạn theo dõi phiếu ${data?.soPhieu || ""}`
          : `${data?.actorName || "Ai đó"} đã gắn bạn theo dõi 1 phiếu`,
        message: data?.soPhieu
          ? `${data?.actorName || "Ai đó"} đã gắn bạn theo dõi phiếu ${data?.soPhieu || ""}`
          : `${data?.actorName || "Ai đó"} đã gắn bạn theo dõi 1 phiếu`,
        ticketId: data?.ticketId,
        soPhieu: data?.soPhieu,
        actorName: data?.actorName,
        status: data?.status,
        timestamp: data?.timestamp,
      });
    });

    s.on("user:force-logout", (data) => {
      const myKey = String(user?.key || user?.username || "").trim().toLowerCase();
      const targetKey = String(data?.userKey || "").trim().toLowerCase();
      if (!myKey) return;
      if (targetKey && targetKey !== myKey) return;
      message.warning("Phiên đăng nhập của bạn đã bị đăng xuất từ xa.");
      setUser(null);
      navigate("/login", { replace: true });
    });

    return () => {
      try {
        s.off("history:new");
        s.off("history:update");
        s.off("history:delete");
        s.off("customer:new");
        s.off("customer:update");
        s.off("customer:delete");
        s.off("user:created");
        s.off("user:updated");
        s.off("user:deleted");
        s.off("user:online");
        s.off("user:offline");
        s.off("user:status:update");
        s.off("suggestions:update");
        s.off("ticket:assigned");
        s.off("ticket:followed-update");
        s.off("ticket:followed");
        s.off("user:force-logout");
      } catch (e) {}
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The effect should run when the authenticated user identity changes,
  // not whenever the `user` object reference changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await Promise.all([loadCustomers(), loadUsers()]);

        const savedPayload = getSavedHistoryFilters();
        if (savedPayload && typeof savedPayload === "object") {
          const restoredFrom = savedPayload.from ? dayjs(savedPayload.from, "YYYY-MM-DD") : null;
          const restoredTo = savedPayload.to ? dayjs(savedPayload.to, "YYYY-MM-DD") : null;
          const normalizedFrom = restoredFrom && restoredFrom.isValid() ? restoredFrom : null;
          const normalizedTo = restoredTo && restoredTo.isValid() ? restoredTo : null;
          const shouldUseDateRange = normalizedFrom && normalizedTo;

          setHistoryKeyword(String(savedPayload.keyword || ""));
          setHistoryFrom(normalizedFrom);
          setHistoryTo(normalizedTo);
          setHistoryCompany(savedPayload.company || undefined);
          setHistoryPrinted(savedPayload.printed === null ? undefined : savedPayload.printed);
          setHistoryStatus(savedPayload.status || undefined);
          setHistoryLoaiPhieu(savedPayload.loaiPhieu || undefined);
          setHistoryNguoiThucHien(savedPayload.nguoiThucHien || undefined);

          await loadHistory({
            page: 1,
            keyword: String(savedPayload.keyword || "") || undefined,
            from: shouldUseDateRange ? normalizedFrom.format("YYYY-MM-DD") : undefined,
            to: shouldUseDateRange ? normalizedTo.format("YYYY-MM-DD") : undefined,
            company: savedPayload.company || undefined,
            printed: savedPayload.printed === null ? undefined : savedPayload.printed,
            status: savedPayload.status || undefined,
            loaiPhieu: savedPayload.loaiPhieu || undefined,
            nguoiThucHien: savedPayload.nguoiThucHien || undefined,
          });
        } else {
          await loadHistory({ page: 1 });
        }
      } catch (e) {
        message.error(e?.message || "Không thể tải dữ liệu");
      }
    })();
  // The effect intentionally tracks user identity, not every object reference.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?._id, user?.key, user?.username, savedHistoryFiltersJson, getSavedHistoryFilters, loadCustomers, loadHistory, loadUsers, message]);

  // Notify backend when user logs in
  useEffect(() => {
    if (!user) return;
    
    const userId = String(user?.id || user?._id || "").trim();
    const userKey = String(user?.key || "").trim();
    
    // Set online status immediately
    setUserStatus(prev => {
      const next = { ...prev };
      if (userId) next[userId] = "online";
      if (userKey) next[userKey] = "online";
      return next;
    });
    
    console.log(`[Frontend] User ${user?.username} login - userId: "${userId}"`);
    // Emit to backend (socket.io will queue if not connected)
    const s = getSocket?.();
    if (s) {
      const emitLogin = () => {
        s.emit("user:login", {
          userId,
          username: user?.username,
          key: user?.key,
          fullNamePrivate: user?.fullNamePrivate,
        });
        console.log(`[Frontend] Emitted user:login event for ${user?.username}`);
      };
      
      if (s.connected) {
        emitLogin();
      } else {
        // Wait for socket to connect
        const timer = setTimeout(emitLogin, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Fetch initial online status from backend
  useEffect(() => {
    const delay = 500; // Wait for socket to connect
    const timer = setTimeout(async () => {
      try {
        console.log("[Frontend] Fetching online status...");
        const onlineStatus = await Api.getOnlineStatus();
        if (onlineStatus && typeof onlineStatus === "object") {
          console.log("[Frontend] Fetched online status:", onlineStatus);
          setUserStatus(prev => {
            const next = { ...prev, ...onlineStatus };
            console.log("[Frontend] Merged userStatus state:", next);
            return next;
          });
        }
      } catch (e) {
        console.log("Could not fetch online status:", e.message);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // Load `tinhTrang` suggestions for the AutoComplete field (Ticket Incident form)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await Api.getSuggestions("tinhTrang");
        if (alive) setTinhTrangSuggestions(Array.isArray(rows) ? rows : []);
    } catch (e) {
        // Suggestions are optional; ignore if backend doesn't support it.
        if (alive) setTinhTrangSuggestions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Merge tinhTrang from history into suggestions (always up-to-date with latest data)
  useEffect(() => {
    const historyTinhTrangs = (history || [])
      .map((r) => String(r?.tinhTrang || "").trim())
      .filter((t) => t.length > 0);
    
    // Merge with existing suggestions and remove duplicates (case-insensitive)
    const merged = [...historyTinhTrangs, ...(tinhTrangSuggestions || [])];
    const uniqueSet = new Map();
    merged.forEach((item) => {
      const lower = String(item).toLowerCase();
      if (!uniqueSet.has(lower)) {
        uniqueSet.set(lower, item);
      }
    });
    
    // Convert map values to array (newest first - history data comes first)
    const updated = Array.from(uniqueSet.values());
    setTinhTrangSuggestions(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  useEffect(() => {
    if (!user) return;
    // Desktop behavior: "Người thực hiện" is always the logged-in user.
    form.setFieldsValue({ nguoiThucHien: performerDisplayName });
  }, [user, performerDisplayName, form]);

  // Auto-logout at midnight (24h)
  useEffect(() => {
    const setupAutoLogout = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      const timeoutId = setTimeout(() => {
        // Logout current user
        if (user) {
          const userId = String(user?.id || user?._id || "").trim();
          const userKey = String(user?.key || "").trim();
          
          // Set offline status
          setUserStatus(prev => {
            const next = { ...prev };
            if (userId) next[userId] = "offline";
            if (userKey) next[userKey] = "offline";
            return next;
          });
          
          setUser(null);
          message.warning("Phiên đăng nhập đã hết hạn lúc 24h. Vui lòng đăng nhập lại");
          window.location.href = "/login";
        }
      }, msUntilMidnight);
      
      return () => clearTimeout(timeoutId);
    };

    if (user) {
      return setupAutoLogout();
    }
  }, [user, message, setUser]);

  useEffect(() => {
    loadTranslations(selectedLanguage, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveTicket = async (vals) => {
    try {
      if (!user) {
        message.warning("Đăng nhập để thao tác");
        return;
      }
      if (savingTicket) return;
      if (String(vals?.status || "").trim().toLowerCase() === "assigned" && !String(vals?.nguoiThucHien || "").trim()) {
        message.warning("Vui lòng chọn người thực hiện khi trạng thái là Assigned");
        return;
      }
      setSavingTicket(true);
      const phuongAnXuLyHtmlValue =
        vals.phuongAnXuLyHtml || getCkEditorHtmlValue("phuongAnXuLy") || vals.phuongAnXuLy || "";
      const ketQuaHtmlValue =
        vals.ketQuaHtml || getCkEditorHtmlValue("ketQua") || vals.ketQua || "";

      const payload = {
        ...vals,
        createdBy: String(user?.key || user?.username || "").trim(),
        soPhieu: vals.soPhieu || (await ensureFormSoPhieu()) || "",
        ngay: vals.ngay ? dayjs(vals.ngay).format("DD/MM/YYYY") : dayjs().format("DD/MM/YYYY"),
        rating: vals.rating !== undefined && vals.rating !== null && vals.rating !== "" ? Number(vals.rating) : null,
        phuongAnXuLy: phuongAnXuLyHtmlValue,
        phuongAnXuLyHtml: phuongAnXuLyHtmlValue,
        ketQua: ketQuaHtmlValue,
        ketQuaHtml: ketQuaHtmlValue,
      };
      await Api.createHistoryWithTicket(payload);
      message.success(`Đã lưu phiếu`.trim());
      form.resetFields();
      setFormResetKey(Date.now()); // reset CKEditor instances
      setTinhTrangFilteredOptions([]);
      setTinhTrangSearchValue("");
      await loadHistory({ page: 1 });
    } catch (e) {
      message.error(e?.message || "Không thể lưu phiếu");
    } finally {
      setSavingTicket(false);
    }
  };

  const currentHistoryRowIds = useMemo(
    () => (history || []).map((r) => String(r?._id || r?.id || r?.soPhieu)),
    [history]
  );

  const selectedInCurrentPageCount = currentHistoryRowIds.filter((id) => (selectedRowKeys || []).includes(id)).length;
  const allSelectedCurrentPage = currentHistoryRowIds.length > 0 && selectedInCurrentPageCount === currentHistoryRowIds.length;
  const historySelectionIndeterminate =
    selectedInCurrentPageCount > 0 && selectedInCurrentPageCount < currentHistoryRowIds.length;

  const ticketFormTab = (
    <IncidentTab
        form={form}
      onSaveTicket={onSaveTicket}
      customers={customers}
      users={users}
      user={user}
      performerDisplayName={performerDisplayName}
      formResetKey={formResetKey}
      setFormResetKey={setFormResetKey}
      tinhTrangSuggestions={tinhTrangSuggestions}
      tinhTrangFilteredOptions={tinhTrangFilteredOptions}
      setTinhTrangFilteredOptions={setTinhTrangFilteredOptions}
      tinhTrangSearchValue={tinhTrangSearchValue}
      setTinhTrangSearchValue={setTinhTrangSearchValue}
      onPrintCurrentForm={handlePrintCurrentForm}
      onDownloadFormPreviewPDF={handleDownloadFormPreviewPDF}
      openFormPrintPreview={openFormPrintPreview}
      printingTicket={printingTicket}
      savingTicket={savingTicket}
      downloadingPdf={downloadingPdf}
      cfg={cfg}
      translations={translations}
    />
  );

  const historyTab = (
    <HistoryTab
      history={history}
      historyLoading={historyLoading}
      filters={filters}
      historyTotal={historyTotal}
      customers={customers}
      users={users}
      user={user}
      cfg={cfg}
      translations={translations}
      selectedLanguage={selectedLanguage}
      onTranslateTicketData={maybeTranslateTicketData}
      historyKeyword={historyKeyword}
      setHistoryKeyword={setHistoryKeyword}
      historyFrom={historyFrom}
      setHistoryFrom={setHistoryFrom}
      historyTo={historyTo}
      setHistoryTo={setHistoryTo}
      historyCompany={historyCompany}
      setHistoryCompany={setHistoryCompany}
      historyPrinted={historyPrinted}
      setHistoryPrinted={setHistoryPrinted}
      setAuthUser={setAuthUser}
      historyStatus={historyStatus}
      setHistoryStatus={setHistoryStatus}
      historyLoaiPhieu={historyLoaiPhieu}
      setHistoryLoaiPhieu={setHistoryLoaiPhieu}
      historyNguoiThucHien={historyNguoiThucHien}
      setHistoryNguoiThucHien={setHistoryNguoiThucHien}
      historyKeywordDebounceRef={historyKeywordDebounceRef}
      selectedRowKeys={selectedRowKeys}
      setSelectedRowKeys={setSelectedRowKeys}
      currentHistoryRowIds={currentHistoryRowIds}
      selectedInCurrentPageCount={selectedInCurrentPageCount}
      allSelectedCurrentPage={allSelectedCurrentPage}
      historySelectionIndeterminate={historySelectionIndeterminate}
      canManagePermission={canManagePermission}
      canEditHistoryRecord={canEditHistoryRecord}
      loadHistory={loadHistory}
      handleApplyHistoryFilters={handleApplyHistoryFilters}
      handleResetHistoryFilters={handleResetHistoryFilters}
      handlePrintSelected={handlePrintSelected}
      exportingExcel={exportingExcel}
      downloadingPdf={downloadingPdf}
      handleExportSupportStatsExcel={handleExportSupportStatsExcel}
      handleDownloadHistoryRecord={handleDownloadHistoryRecord}
      handleOpenEditHistory={handleOpenEditHistory}
      handleDeleteHistory={handleDeleteHistory}
      handlePrintHistoryRecord={handlePrintHistoryRecord}
      handleConfirmPrintSelected={handleConfirmPrintSelected}
      handleCancelBatchPrint={handleCancelBatchPrint}
      confirmPrintModalVisible={confirmPrintModalVisible}
      setConfirmPrintModalVisible={setConfirmPrintModalVisible}
      progressModalVisible={progressModalVisible}
      setProgressModalVisible={setProgressModalVisible}
      printProgress={printProgress}
      historyEditRecord={historyEditRecord}
      setHistoryEditRecord={setHistoryEditRecord}
      historyEditForm={historyEditForm}
      handleSaveEditHistory={handleSaveEditHistory}
    />
  );

  const settingsTab = (
    <SettingsTab
      selectedLanguage={selectedLanguage}
      onChangeLanguage={(lang) => loadTranslations(lang, true)}
      currentUser={user}
    />
  );


  const usersManagementTab = (
    <AccountTab
      users={users}
      loading={usersLoading}
      filter={usersFilter}
      canManagePermission={canManagePermission}
      permissionLabels={permissionLabels}
      onEdit={(id, vals) => handleEditUser(id, vals)}
      onTogglePermission={(record, val) => handleToggleUserPermission(record, val)}
      onDelete={(id, username) => handleDeleteUser(id, username)}
      onRemoteLogout={(record) => handleRemoteLogoutUser(record)}
      usersFilter={usersFilter}
      setUsersFilter={setUsersFilter}
      loadUsers={loadUsers}
      setUsersDrawerVisible={setUsersDrawerVisible}
      userStatus={userStatus}
      customers={customers}
    />
  );

  const customersManagementTab = (
    <CustomerTab
      data={customers}
      loading={customersLoading}
      onEdit={(id, vals) => handleEditCustomer(id, vals)}
      onDelete={(id, companyName) => handleDeleteCustomer(id, companyName)}
      filter={customersFilter}
      customersFilter={customersFilter}
      setCustomersFilter={setCustomersFilter}
      loadCustomers={loadCustomers}
      setCustomersDrawerVisible={setCustomersDrawerVisible}
    />
  );

  const customerDashboardTab = (
    <CustomerDashboard
      history={history}
      historyLoading={historyLoading}
      currentUser={user}
      customers={customers}
      onPrintRecord={handlePrintHistoryRecord}
      onDownloadRecord={handleDownloadHistoryRecord}
      onOpenViewRecord={handleOpenEditHistory}
      loadHistory={loadHistory}
    />
  );

  const customerAccountManagementTab = (
    <CustomerAccountManagement
      users={users}
      loading={usersLoading}
      currentUser={user}
      customers={customers}
      userStatus={userStatus}
      onEdit={(id, vals) => handleEditUser(id, vals)}
      onDelete={(id, username) => handleDeleteUser(id, username)}
      onReload={loadUsers}
      onAddAccount={handleCreateCustomerAccount}
      addAccountVisible={customerAccountCreationVisible}
      setAddAccountVisible={setCustomerAccountCreationVisible}
      addAccountLoading={customerAccountCreationLoading}
    />
  );

  const items = isCustomerUser
    ? [
        { key: "form", label: <><FileTextOutlined /> Ticket Incident</>, children: ticketFormTab },
        { key: "dashboard", label: <><HomeOutlined /> Danh sách phiếu</>, children: customerDashboardTab },
        { key: "customer-accounts", label: <><TeamOutlined /> Tài khoản</>, children: customerAccountManagementTab },
        { key: "settings", label: <><SettingOutlined /> Settings</>, children: settingsTab },
      ]
    : [
        { key: "form", label: <><FileTextOutlined /> Ticket Incident</>, children: ticketFormTab },
        { key: "history", label: <><HistoryOutlined /> Ticket History</>, children: historyTab },
        ...(canManageTabVisible
          ? [{ key: "users", label: <><TeamOutlined /> Account Management</>, children: usersManagementTab }]
          : []),
        ...(canManagePermission
          ? [{ key: "customers", label: <><UserOutlined /> Customer Management</>, children: customersManagementTab }]
          : []),
        { key: "settings", label: <><SettingOutlined /> Settings</>, children: settingsTab },
      ];
  const tabKeyFromUrl = tab || "form";
  const allowedKeys = items.map((i) => i.key);
  const fallbackKey = allowedKeys.includes("form") ? "form" : allowedKeys[0] || "form";
  const currentTabKey = allowedKeys.includes(tabKeyFromUrl) ? tabKeyFromUrl : fallbackKey;

  // Tab bar extra actions (Save/Print like desktop header actions)
  const tabBarExtraContent = (
    <Space size={8} wrap>
      {currentTabKey === "form" ? (
        <>
          <Select
            value={formStatus || "new"}
            style={{ width: 170 }}
            disabled={!user || savingTicket}
            variant="filled"
            onChange={(val) => {
              if (val === "assigned") {
                const rawPerformer = String(form.getFieldValue("nguoiThucHien") || "").trim();
                const matchedUser = (users || []).find((u) => {
                  const key = String(u?.key || "").trim().toLowerCase();
                  const username = String(u?.username || "").trim().toLowerCase();
                  const fullName = String(u?.fullNamePrivate || "").trim().toLowerCase();
                  const normalized = rawPerformer.toLowerCase();
                  return normalized && (normalized === key || normalized === username || normalized === fullName);
                });
                const fallbackUser = matchedUser || getPerformerUser(rawPerformer);
                setAssignStatusPerformer(getUserAssignValue(fallbackUser));
                setAssignStatusModalVisible(true);
                return;
              }
              form.setFieldsValue({ status: val });
            }}
            options={[
              { label: "New", value: "new" },
              { label: "Assigned", value: "assigned" },
              { label: "In Progress", value: "in_progress" },
              { label: "Pending", value: "pending" },
              { label: "Resolved", value: "resolved" },
              { label: "Closed", value: "closed" },
            ]}
          />
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={savingTicket}
            disabled={!user}
          >
            Lưu (Ctrl+S)
          </Button>
          <Button
            onClick={() => openFormPrintPreview()}
            disabled={!user || savingTicket}
          >
            In (Ctrl+P)
          </Button>
        </>
      ) : null}
    </Space>
  );

  // Keyboard shortcuts (frontend reference): Ctrl+S to save, Ctrl+P to print.
  // Only active when the "form" tab is shown.
  useEffect(() => {
    const activeIsForm = !tab || tab === "form";
    if (!activeIsForm) return;
    if (!user) return;

    const handleKeyDown = (e) => {
      const key = String(e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        if (!savingTicket) form.submit();
      }
      if ((e.ctrlKey || e.metaKey) && key === "p") {
        e.preventDefault();
        if (!savingTicket) openFormPrintPreview();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user, savingTicket, form]);

  useEffect(() => {
    if (tabKeyFromUrl !== currentTabKey) {
      navigate(`/app/${currentTabKey}`, { replace: true });
    }
  }, [tabKeyFromUrl, currentTabKey, navigate]);

  return (
    <div style={{ height: "100%", overflow: "hidden" }}>
      {isMobile ? (
        // On mobile, render only the current tab content without tabs
        <div style={{ height: "100%", overflow: "auto" }}>
          {items.find(item => item.key === currentTabKey)?.children}
        </div>
      ) : (
        <Tabs
          activeKey={currentTabKey}
          onChange={(nextKey) => navigate(`/app/${nextKey}`)}
          items={items}
          type="card"
          size="small"
          style={{ height: "100%", gap: 12 }}
          tabBarStyle={{ marginBottom: 0 }}
          tabBarExtraContent={tabBarExtraContent}
        />
      )}
      <Modal
        title="Chọn người thực hiện"
        open={assignStatusModalVisible}
        onCancel={() => {
          setAssignStatusModalVisible(false);
          setAssignStatusPerformer("");
        }}
        onOk={() => {
          if (!assignStatusPerformer) {
            message.error("Vui lòng chọn người thực hiện");
            return;
          }
          form.setFieldsValue({
            status: "assigned",
            nguoiThucHien: assignStatusPerformer,
          });
          setAssignStatusModalVisible(false);
          setAssignStatusPerformer("");
        }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <Form layout="vertical">
          <Form.Item label="Người thực hiện" required>
            <Select
              showSearch
              optionLabelProp="title"
              optionFilterProp="title"
              getPopupContainer={(node) => node?.parentElement || document.body}
              placeholder="Chọn người thực hiện"
              value={assignStatusPerformer || undefined}
              onChange={(v) => setAssignStatusPerformer(v)}
              options={(users || [])
                .map((u) => {
                  const name = u.fullNamePrivate || u.username || u.key;
                  const chucVu = u.chucVu || "";
                  const value = getUserAssignValue(u);
                  return {
                    title: name,
                    label: (
                      <div>
                        <div>{name}</div>
                        {chucVu ? <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div> : null}
                      </div>
                    ),
                    value,
                  };
                })
                .filter((o) => o.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
        <Drawer
          title="Thêm tài khoản"
          placement="right"
          size={500}
          open={usersDrawerVisible}
          onClose={() => {
            setUsersDrawerVisible(false);
            createUserForm.resetFields();
          }}
          destroyOnHidden
        >
          <Form
            form={createUserForm}
            layout="vertical"
            onFinish={handleCreateUser}
            initialValues={{ permission: "none" }}
          >
            <Form.Item label="Username" name="username" rules={[{ required: true, message: "Vui lòng nhập username" }]}>
              <Input placeholder="Username" />
            </Form.Item>
            <Form.Item label="Password" name="password" rules={[{ required: true, message: "Vui lòng nhập password" }]}>
              <Input.Password placeholder="Password" />
            </Form.Item>
            <Form.Item label="Họ tên riêng" name="fullNamePrivate">
              <Input placeholder="Họ tên riêng" />
            </Form.Item>
            <Form.Item label="Chức vụ" name="chucVu">
              <Input placeholder="Nhập chức vụ" />
            </Form.Item>
            <Form.Item label="Quyền" name="permission">
              <Select
                options={[
                  { label: permissionLabels.noneLabel || "Không có quyền", value: "none" },
                  { label: permissionLabels.editLabel || "Chỉnh sửa", value: "edit" },
                  { label: permissionLabels.manageLabel || "Quản lý", value: "manage" },
                  { label: permissionLabels.customerLabel || "Khách hàng", value: "customer" },
                ]}
              />
            </Form.Item>
            {permission === "customer" && (
              <Form.Item 
                label="Công ty / Chi nhánh" 
                name="assignedCustomer"
                rules={[{ required: true, message: "Vui lòng chọn công ty / chi nhánh" }]}
              >
                <Select
                  placeholder="Chọn công ty"
                  options={customers.map((c) => ({
                    label: c.companyName,
                    value: c._id || c.id,
                  }))}
                />
              </Form.Item>
            )}
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Thêm
              </Button>
            </Form.Item>
          </Form>
        </Drawer>

        <Modal
          title="Chọn công ty / chi nhánh"
          open={customerSelectModalVisible}
          onCancel={() => {
            setCustomerSelectModalVisible(false);
            setPendingCustomerUser(null);
            setSelectedCustomerForUser(null);
          }}
          onOk={handleSelectCustomerForUser}
          okText="Xác nhận"
          cancelText="Hủy"
          confirmLoading={customerSelectModalLoading}
        >
          <Form layout="vertical">
            <Form.Item label="Công ty / Chi nhánh" required>
              <Select
                placeholder="Chọn công ty"
                value={selectedCustomerForUser || undefined}
                onChange={(val) => setSelectedCustomerForUser(val)}
                options={customers.map((c) => ({
                  label: c.companyName,
                  value: c._id || c.id,
                }))}
              />
            </Form.Item>
          </Form>
        </Modal>

        <Drawer
          title="Thêm khách hàng"
          placement="right"
          size={500}
          open={customersDrawerVisible}
          onClose={() => setCustomersDrawerVisible(false)}
          destroyOnHidden
        >
          <Form
            layout="vertical"
            onFinish={handleCreateCustomer}
          >
            <Form.Item label="Tên công ty" name="companyName" rules={[{ required: true, message: "Vui lòng nhập tên công ty" }]}>
              <Input placeholder="Tên công ty" />
            </Form.Item>
            <Form.Item label="Người liên hệ" name="name" rules={[{ required: true, message: "Vui lòng nhập người liên hệ" }]}>
              <Input placeholder="Người liên hệ" />
            </Form.Item>
            <Form.Item label="Số điện thoại" name="phone">
              <Input placeholder="Số điện thoại" />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="address">
              <Input.TextArea placeholder="Địa chỉ" autoSize={{ minRows: 2 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                Thêm
              </Button>
            </Form.Item>
          </Form>
        </Drawer>
    </div>
  );
}

function AppLayout({ authUser, setAuthUser, onLogout }) {
  const navigate = useNavigate();
  const { tab } = useParams();
  const currentTabKey = tab || "form";
  const [pendingNotificationPreview, setPendingNotificationPreview] = useState(null);
  const { message } = AntApp.useApp();

  // Form print preview modal states
  const [formPrintPreviewOpen, setFormPrintPreviewOpen] = useState(false);
  const [formPrintPreviewData, setFormPrintPreviewData] = useState(null);
  const [formPrintPreviewLoading, setFormPrintPreviewLoading] = useState(false);
  const [formPrintPreviewPrinting, setFormPrintPreviewPrinting] = useState(false);
  const [formPrintPreviewPrintAction, setFormPrintPreviewPrintAction] = useState(null);

  const isAdminUser = String(authUser?.username || authUser?.key || "")
    .trim()
    .toLowerCase() === "admin";
  const canManagePermission =
    authUser?.canManage === true ||
    authUser?.canManage === "true" ||
    isAdminUser;

  const [siderCollapsed, setSiderCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('siderCollapsed');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [openKeys, setOpenKeys] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [notificationsTotal, setNotificationsTotal] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const unreadNotificationCount = (notifications || []).filter((n) => !n.read).length;
  const notificationsHasMore = (notifications || []).length < (notificationsTotal || 0);
  const mapNotificationRow = (n) => ({
    id: String(n?._id || n?.id || ""),
    read: Boolean(n?.read),
    createdAt: n?.createdAt || Date.now(),
    type: n?.type,
    title: n?.title,
    message: n?.message,
    ticketId: n?.ticketId,
    soPhieu: n?.soPhieu,
    assignedBy: n?.assignedBy,
    assignedByName: n?.assignedByName,
    actorName: n?.actorName,
    status: n?.status,
  });

  const loadNotificationsPage = async (page = 1, append = false) => {
    const userKey = String(authUser?.key || authUser?.username || "").trim();
    if (!userKey) {
      setNotifications([]);
      setNotificationsPage(1);
      setNotificationsTotal(0);
      return;
    }
    if (notificationsLoading) return;
    setNotificationsLoading(true);
    try {
      const res = await Api.listNotifications(userKey, page, 20);
      const rows = Array.isArray(res?.data) ? res.data.map(mapNotificationRow) : [];
      const total = Number(res?.total || 0);
      setNotificationsTotal(total);
      setNotificationsPage(page);
      setNotifications((prev) => {
        if (!append) return rows;
        const merged = [...(prev || []), ...rows];
        const seen = new Set();
        return merged.filter((item) => {
          const k = String(item.id);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      });
    } catch (e) {
      if (!append) {
        setNotifications([]);
        setNotificationsTotal(0);
        setNotificationsPage(1);
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    if (notificationsLoading || !notificationsHasMore) return;
    await loadNotificationsPage((notificationsPage || 1) + 1, true);
  };

  const showBrowserNotification = async (payload) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        return;
      }
    }
    if (Notification.permission !== "granted") return;

    const title = payload?.title || "Thông báo mới";
    const body = payload?.message || payload?.title || payload?.status || payload?.soPhieu || "Bạn có thông báo mới";
    const tag = String(payload?.notificationId || payload?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    try {
      const notification = new Notification(title, {
        body,
        tag,
        renotify: true,
      });
      notification.onclick = () => {
        window.focus();
      };
    } catch (err) {
      // ignore browser notification failures
    }
  };

  const pushAssignmentNotification = (payload) => {
    const id = String(payload?.notificationId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setNotifications((prev) => [
      {
        id,
        read: false,
        createdAt: payload?.timestamp || Date.now(),
        ...payload,
      },
      ...(prev || []).filter((n) => String(n.id) !== id),
    ]);
    setNotificationsTotal((prev) => (Number(prev || 0) + 1));
    showBrowserNotification({ ...payload, notificationId: id });
  };
  const markNotificationRead = async (id, notification) => {
    const userKey = String(authUser?.key || authUser?.username || "").trim();
    setNotifications((prev) => (prev || []).map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n)));
    try {
      if (userKey) {
        await Api.markNotificationRead(id, userKey);
      }
    } catch (e) {}
    setPendingNotificationPreview(notification || null);
  };

  useEffect(() => {
    loadNotificationsPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.key, authUser?.username]);

  useEffect(() => {
    try {
      localStorage.setItem('siderCollapsed', JSON.stringify(siderCollapsed));
    } catch {}
  }, [siderCollapsed]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const openFromNotification = async () => {
      const notification = pendingNotificationPreview;
      if (!notification) return;

      const ticketId = String(notification?.ticketId || "").trim();
      const soPhieu = String(notification?.soPhieu || "").trim();
      if (!ticketId && !soPhieu) {
        setPendingNotificationPreview(null);
        return;
      }

      setFormPrintPreviewLoading(true);
      setFormPrintPreviewData(null);
      setFormPrintPreviewOpen(true);

      let record = null;
      try {
        if (ticketId) {
          record = await Api.getHistoryById(ticketId);
        }
        if (!record && soPhieu) {
          const res = await Api.searchHistory({ keyword: soPhieu, page: 1, pageSize: 1 });
          const rows = Array.isArray(res?.data) ? res.data : [];
          record = rows.find((r) => String(r?.soPhieu || "").trim() === soPhieu) || rows[0] || null;
        }
        if (!record) {
          message.warning("Không tìm thấy phiếu cho thông báo này");
          setFormPrintPreviewOpen(false);
          return;
        }

        setFormPrintPreviewData(record);
      } catch (e) {
        message.error(e?.message || "Không thể mở xem trước in");
        setFormPrintPreviewOpen(false);
      } finally {
        setFormPrintPreviewLoading(false);
        setPendingNotificationPreview(null);
      }
    };

    openFromNotification();
  }, [pendingNotificationPreview, message]);

  const homeChildren = [
    { key: "form", icon: <FileTextOutlined />, label: "Ticket Incident" },
    { key: "history", icon: <HistoryOutlined />, label: "Ticket History" },
    ...(canManagePermission ? [{ key: "users", icon: <TeamOutlined />, label: "Account Management" }] : []),
    ...(canManagePermission ? [{ key: "customers", icon: <UserOutlined />, label: "Customer Management" }] : []),
    { key: "settings", icon: <SettingOutlined />, label: "Settings" },
  ];

  const siderItems = [
    { key: "home", icon: <HomeOutlined />, label: "Home", children: homeChildren },
    { key: "__change_pass__", icon: <LockOutlined />, label: "Đổi mật khẩu" },
  ];

  const onClickSider = ({ key }) => {
    if (key === "__change_pass__") {
      navigate("/app/change-password");
      return;
    }
    navigate(`/app/${key}`);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  const { Header: AntHeader, Sider, Content } = Layout;

  const selectedKey = currentTabKey === "change-password" ? "__change_pass__" : currentTabKey;

  const menuContent = (
    <Menu
      mode="inline"
      inlineCollapsed={siderCollapsed && !isMobile}
      selectedKeys={[selectedKey]}
      openKeys={openKeys}
      items={siderItems}
      onClick={onClickSider}
      onOpenChange={(keys) => {
        setOpenKeys(keys);
      }}
    />
  );

  return (
    <Layout style={{ height: "100vh" }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={siderCollapsed}
          onCollapse={setSiderCollapsed}
          width={240}
          theme="light"
          style={{ borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column" }}
        >
          <div className="sider-user-info">
            <div className="user-card">
              <UserAvatar
                size={siderCollapsed ? 40 : 80}
                name={authUser?.fullNamePrivate || authUser?.username || authUser?.key || "U"}
                style={{ marginBottom: "8px" }}
              >
                {(authUser?.fullNamePrivate || authUser?.username || authUser?.key || "U")[0].toUpperCase()}
              </UserAvatar>
              {!siderCollapsed && (
                <div className="user-details">
                  <div className="user-name" title={authUser?.fullNamePrivate || authUser?.username || authUser?.key || "User"}>
                    {authUser?.fullNamePrivate || authUser?.username || authUser?.key || "User"}
                  </div>
                  <div className="user-department" title={authUser?.chucVu || "N/A"}>
                    {authUser?.chucVu || "N/A"}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {menuContent}
          </div>
        </Sider>
      )}

      <Layout>
        <AntHeader style={{ padding: 0, height: 56, background: "#fff" }}>
          <Header
            authUser={authUser}
            onLogout={onLogout}
            onOpenChangePassword={() => navigate("/app/change-password")}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            onMarkNotificationRead={markNotificationRead}
            notificationsLoading={notificationsLoading}
            notificationsHasMore={notificationsHasMore}
            onLoadMoreNotifications={loadMoreNotifications}
            mobileMenuButton={isMobile ? (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setDrawerVisible(true)}
                style={{ border: "none", boxShadow: "none" }}
              />
            ) : null}
          />
        </AntHeader>
        <Content style={{ overflow: "hidden" }}>
          <div style={{ height: "calc(100vh - 56px)", padding: 12, overflow: "hidden", background: "linear-gradient(180deg, #f7faff 0%, #eef3fb 100%)" }}>
      <Outlet
        context={{
          authUser,
          setAuthUser,
          pushAssignmentNotification,
          pendingNotificationPreview,
          clearPendingNotificationPreview: () => setPendingNotificationPreview(null),
          formPrintPreviewOpen,
          setFormPrintPreviewOpen,
          formPrintPreviewData,
          setFormPrintPreviewData,
          formPrintPreviewLoading,
          setFormPrintPreviewLoading,
          formPrintPreviewPrintAction,
          setFormPrintPreviewPrintAction,
        }}
      />
    </div>
        </Content>
      </Layout>

      {isMobile && (
        <Drawer
          title="Menu"
          placement="left"
          open={drawerVisible}
          onClose={() => setDrawerVisible(false)}
          width={240}
          styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
        >
          <div className="sider-user-info">
            <div className="user-card">
              <UserAvatar
                size={80}
                name={authUser?.fullNamePrivate || authUser?.username || authUser?.key || "U"}
                style={{ marginBottom: "8px" }}
              >
                {(authUser?.fullNamePrivate || authUser?.username || authUser?.key || "U")[0].toUpperCase()}
              </UserAvatar>
              <div className="user-details">
                <div className="user-name" title={authUser?.fullNamePrivate || authUser?.username || authUser?.key || "User"}>
                  {authUser?.fullNamePrivate || authUser?.username || authUser?.key || "User"}
                </div>
                <div className="user-department" title={authUser?.chucVu || "N/A"}>
                  {authUser?.chucVu || "N/A"}
                </div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {menuContent}
          </div>
        </Drawer>
      )}

      {/* Form Print Preview Loading Overlay */}
      {formPrintPreviewLoading && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <Spin size="middle" indicator={<LoadingOutlined spin />} />
        </div>
      )}

      {/* Form Print Preview Modal */}
      <Modal
        open={formPrintPreviewOpen && !formPrintPreviewLoading}
        title="Xem trước in"
        onCancel={() => setFormPrintPreviewOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setFormPrintPreviewOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            onClick={async () => {
              if (typeof formPrintPreviewPrintAction !== "function") {
                message.error("Không thể in: chưa sẵn sàng");
                return;
              }
              if (formPrintPreviewPrinting || formPrintPreviewLoading) return;
              setFormPrintPreviewPrinting(true);
              try {
                await formPrintPreviewPrintAction();
              } finally {
                setFormPrintPreviewPrinting(false);
              }
            }}
            loading={formPrintPreviewPrinting}
            disabled={formPrintPreviewLoading || formPrintPreviewPrinting || typeof formPrintPreviewPrintAction !== "function"}
          >
            In phiếu
          </Button>,
        ]}
        width="100%"
        centered
        styles={{
          body: {
            maxHeight: window.innerWidth < 768 ? "auto" : "calc(100vh - 170px)",
            overflow: "auto",
            minHeight: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
          },
        }}
      >
        <div className="preview-wrapper-modal">
          {formPrintPreviewData && (
            <Preview data={formPrintPreviewData} config={appConfig} translations={{}} />
          )}
        </div>
      </Modal>
    </Layout>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const lastFetchedUserIdRef = useRef("");
  const userFetchTimeoutRef = useRef(0);

  useEffect(() => {
    try {
      if (authUser) localStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
      else localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;

    const userId = String(authUser?._id || authUser?.id || authUser?.key || authUser?.username || "").trim();
    if (!userId) return;

    // Only fetch if userId changed AND enough time has passed since last fetch
    if (userId === lastFetchedUserIdRef.current && Date.now() - userFetchTimeoutRef.current < 5000) {
      return;
    }

    lastFetchedUserIdRef.current = userId;
    userFetchTimeoutRef.current = Date.now();

    Api.getUserById(userId)
      .then((serverUser) => {
        if (serverUser) {
          setAuthUser((prev) => ({
            ...(prev || {}),
            ...(serverUser || {}),
          }));
        }
      })
      .catch(() => {
        // ignore refresh fetch failures
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.key, authUser?.username, authUser?._id, authUser?.id]);

  const logout = () => {
    setAuthUser(null);
  };

  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <Suspense fallback={<PageLoader />}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
            <Route
              path="/login"
              element={
                authUser ? <Navigate to="/app/form" replace /> : <Login setAuthUser={setAuthUser} />
              }
            />

            <Route
              path="/app/*"
              element={
                authUser ? (
                  <AppLayout authUser={authUser} setAuthUser={setAuthUser} onLogout={logout} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >
              <Route index element={<Navigate to="form" replace />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
              <Route path=":tab" element={<TicketContent />} />
            </Route>

            <Route
              path="*"
              element={<Navigate to={authUser ? "/app/form" : "/login"} replace />}
            />
          </Routes>
        </BrowserRouter>
      </Suspense>
      </AntApp>
    </ConfigProvider>
  );
}

