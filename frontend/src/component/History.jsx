import React, { useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  List,
  message,
  Modal,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PrinterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Preview from "./Viewprint";
import CkEditor from "./CkEditor";
import UserAvatar from "./UserAvatar";
import { Api } from "../service/Api";
import dayjs from "dayjs";

export default function HistoryTab({
  history,
  historyLoading,
  filters,
  historyTotal,
  customers,
  users,
  user,
  setAuthUser,
  cfg,
  translations,
  selectedLanguage,
  onTranslateTicketData,

  historyKeyword,
  setHistoryKeyword,
  historyFrom,
  setHistoryFrom,
  historyTo,
  setHistoryTo,
  historyCompany,
  setHistoryCompany,
  historyPrinted,
  setHistoryPrinted,
  historyStatus,
  setHistoryStatus,
  historyLoaiPhieu,
  setHistoryLoaiPhieu,
  historyNguoiThucHien,
  setHistoryNguoiThucHien,
  historyKeywordDebounceRef,

  selectedRowKeys,
  setSelectedRowKeys,
  currentHistoryRowIds,
  selectedInCurrentPageCount,
  allSelectedCurrentPage,
  historySelectionIndeterminate,

  canManagePermission,
  canEditHistoryRecord,

  loadHistory,
  handleApplyHistoryFilters,
  handleResetHistoryFilters,
  handlePrintSelected,
  exportingExcel,
  downloadingPdf,
  handleExportSupportStatsExcel,
  handleDownloadHistoryRecord,
  handleOpenEditHistory,
  handleDeleteHistory,
  handlePrintHistoryRecord,
  handleConfirmPrintSelected,
  handleCancelBatchPrint,

  confirmPrintModalVisible,
  setConfirmPrintModalVisible,
  progressModalVisible,
  setProgressModalVisible,
  printProgress,

  historyEditRecord,
  setHistoryEditRecord,
  historyEditForm,
  handleSaveEditHistory,
}) {
  const HISTORY_FILTER_STORAGE_PREFIX = "ticket-history-filters-v1";
  const TICKET_STATUS_OPTIONS = [
    { label: "New", value: "new" },
    { label: "Assigned", value: "assigned" },
    { label: "In Progress", value: "in_progress" },
    { label: "Pending", value: "pending" },
    { label: "Resolved", value: "resolved" },
    { label: "Closed", value: "closed" },
  ];

  const normalizeTicketStatus = (status) => {
    const raw = String(status || "").trim().toLowerCase();
    if (
      !raw ||
      raw === "hoàn tất" ||
      raw === "hoan tat" ||
      raw === "done" ||
      raw === "completed" ||
      raw === "closed"
    ) {
      return "closed";
    }
    if (
      raw === "đang xử lý" ||
      raw === "dang xu ly" ||
      raw === "in progress" ||
      raw === "in_progress" ||
      raw === "inprogress"
    ) {
      return "in_progress";
    }
    if (raw === "pending") return "pending";
    if (raw === "new") return "new";
    if (raw === "assigned") return "assigned";
    if (raw === "resolved") return "resolved";
    return raw;
  };

  const formatTicketStatus = (status) => {
    const normalized = normalizeTicketStatus(status);
    return (
      TICKET_STATUS_OPTIONS.find((item) => item.value === normalized)?.label ||
      String(status || "").trim() ||
      "Closed"
    );
  };

  const [historyPreviewVisible, setHistoryPreviewVisible] = useState(false);
  const [historyPreviewRecord, setHistoryPreviewRecord] = useState(null);
  const [historyTimelineVisible, setHistoryTimelineVisible] = useState(false);
  const [historyTimelineRecord, setHistoryTimelineRecord] = useState(null);
  const [historyTimelineEntries, setHistoryTimelineEntries] = useState([]);
  const [historyTimelineLoading, setHistoryTimelineLoading] = useState(false);
  const [printingFromPreview, setPrintingFromPreview] = useState(false);
  const [downloadingRecords, setDownloadingRecords] = useState(new Set());

  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignModalRecord, setAssignModalRecord] = useState(null);
  const [assignModalPerformer, setAssignModalPerformer] = useState("");
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followersModalRecord, setFollowersModalRecord] = useState(null);
  const [followersModalValue, setFollowersModalValue] = useState([]);
  const ignorePreviewUntilRef = useRef(0);

  const temporarilyIgnorePreviewOpen = (ms = 400) => {
    ignorePreviewUntilRef.current = Date.now() + ms;
  };

  const historyFilterStorageKey = (() => {
    const userIdentity = String(user?.id || user?._id || user?.key || user?.username || "")
      .trim()
      .toLowerCase();
    if (!userIdentity) return "";
    return `${HISTORY_FILTER_STORAGE_PREFIX}:${userIdentity}`;
  })();

  const buildCurrentHistoryFilterPayload = () => ({
    keyword: historyKeyword || "",
    from: historyFrom ? dayjs(historyFrom).format("YYYY-MM-DD") : null,
    to: historyTo ? dayjs(historyTo).format("YYYY-MM-DD") : null,
    company: historyCompany || null,
    printed: historyPrinted === undefined ? null : historyPrinted,
    status: historyStatus || null,
    loaiPhieu: historyLoaiPhieu || null,
    nguoiThucHien: historyNguoiThucHien || null,
  });

  const saveHistoryFiltersForCurrentUser = async () => {
    if (!historyFilterStorageKey) {
      message.warning("Không xác định được tài khoản để lưu bộ lọc");
      return;
    }

    const payload = {
      savedAt: new Date().toISOString(),
      filters: buildCurrentHistoryFilterPayload(),
    };

    const userId = String(user?.id || user?._id || user?.key || user?.username || "").trim();
    if (!userId) {
      message.error("Không xác định được tài khoản để lưu bộ lọc");
      return;
    }

    try {
      const updatedUser = await Api.updateUser(userId, {
        savedHistoryFilters: payload,
      });
      if (typeof setAuthUser === "function") {
        setAuthUser((prev) => ({
          ...(prev || {}),
          ...(updatedUser || {}),
          savedHistoryFilters: payload,
        }));
      }
      await handleApplyHistoryFilters();
      message.success("Đã lưu bộ lọc");
    } catch (e) {
      console.error("Lỗi lưu bộ lọc:", e);
      message.error("Không thể lưu bộ lọc");
    }
  };

  const hasSavedHistoryFilter = (() => {
    return Boolean(user?.savedHistoryFilters);
  })();

  const closeAssignModal = () => {
    setAssignModalVisible(false);
    setAssignModalRecord(null);
    setAssignModalPerformer("");
  };

  const normalizeFollowerValue = (value) => {
    if (value && typeof value === "object") {
      return String(value.key || value.username || value.fullNamePrivate || value.email || "").trim();
    }
    return String(value || "").trim();
  };

  const normalizeFollowerKey = (v) => normalizeFollowerValue(v).toLowerCase();

  const getUserByKeyOrUsernameLoose = (value) => {
    const raw = normalizeFollowerValue(value);
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    return (users || []).find((u) => {
      const key = String(u?.key || "").trim().toLowerCase();
      const username = String(u?.username || "").trim().toLowerCase();
      const fullName = String(u?.fullNamePrivate || "").trim().toLowerCase();
      const email = String(u?.email || "").trim().toLowerCase();
      return (
        (key && key === normalized) ||
        (username && username === normalized) ||
        (fullName && fullName === normalized) ||
        (email && email === normalized)
      );
    });
  };

  const getFollowerDisplayInfo = (value) => {
    const rawValue = normalizeFollowerValue(value);
    const user = getUserByKeyOrUsernameLoose(rawValue);
    const displayName = String(user?.fullNamePrivate || user?.username || user?.key || rawValue || "").trim();
    const tooltip = user
      ? displayName
      : rawValue
      ? "Tài khoản không tồn tại"
      : "(Không rõ tài khoản)";
    return { rawValue, displayName, user, tooltip };
  };

  const getFollowersForRecord = (record) => {
    const base = Array.isArray(record?.followers) ? record.followers : [];
    const performer = record?.nguoiThucHien ? [record.nguoiThucHien] : [];
    const merged = [...base, ...performer]
      .map((v) => normalizeFollowerKey(v))
      .filter(Boolean);
    return Array.from(new Set(merged));
  };

  const openFollowersModal = (record) => {
    temporarilyIgnorePreviewOpen();
    const performerKey = normalizeFollowerKey(record?.nguoiThucHien || "");
    const selectedFollowers = getFollowersForRecord(record || {}).filter(
      (k) => !performerKey || k !== performerKey
    );
    setFollowersModalRecord(record || null);
    setFollowersModalValue(selectedFollowers);
    setFollowersModalVisible(true);
  };

  const closeFollowersModal = () => {
    setFollowersModalVisible(false);
    setFollowersModalRecord(null);
    setFollowersModalValue([]);
  };

  const handleSaveFollowers = async () => {
    const record = followersModalRecord;
    const id = String(record?._id || record?.id || "").trim();
    if (!id) {
      message.error("Không tìm thấy ID phiếu");
      return;
    }
    const actor = String(user?.key || user?.username || "").trim();
    if (!actor) {
      message.error("Không xác định được người dùng hiện tại");
      return;
    }
    try {
      const nextFollowers = Array.from(
        new Set((followersModalValue || []).map((v) => normalizeFollowerKey(v)).filter(Boolean))
      );
      await Api.updateHistory(id, {
        currentUser: actor,
        updatedBy: actor,
        followers: nextFollowers,
      });
      message.success("Đã cập nhật người theo dõi");
      closeFollowersModal();
      loadHistory({ page: filters?.page || 1 });
    } catch (e) {
      message.error(e?.message || "Không thể cập nhật người theo dõi");
    }
  };

  const getPerformerUser = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    return (users || []).find((u) => {
      const key = String(u?.key || "").trim();
      const username = String(u?.username || "").trim();
      const fullName = String(u?.fullNamePrivate || "").trim();
      const email = String(u?.email || "").trim();
      return (
        (key && key.toLowerCase() === normalized) ||
        (username && username.toLowerCase() === normalized) ||
        (fullName && fullName.toLowerCase() === normalized) ||
        (email && email.toLowerCase() === normalized)
      );
    });
  };

  const getUserAssignValue = (u) => {
    return String(u?.key || u?.username || u?.fullNamePrivate || "").trim();
  };

  const handleOpenHistoryPreview = async (record) => {
    const id = String(record?._id || record?.id || "").trim();
    let baseRecord = record || {};

    // If the list API was loaded with lightweight fields, fetch full record on-demand for preview/print.
    const missingHeavyFields =
      baseRecord?.phuongAnXuLyHtml === undefined ||
      baseRecord?.ketQuaHtml === undefined ||
      baseRecord?.phuongAnXuLy === undefined ||
      baseRecord?.ketQua === undefined;
    if (id && missingHeavyFields) {
      try {
        baseRecord = await Api.getHistoryById(id);
      } catch (e) {
        // If it fails, fall back to the partial record; preview will still open.
      }
    }

    const mappedRecord = {
      ...(baseRecord || {}),
      nguoiThucHien: getPerformerDisplayName(baseRecord?.nguoiThucHien),
    };
    
    // Load performer signature only when the ticket performer has one
    try {
      const performerUser = getPerformerUser(mappedRecord?.nguoiThucHien);
      const performerId = performerUser ? String(performerUser?.id || performerUser?._id || "").trim() : "";
      if (performerId) {
        const sig = await Api.getSignature(performerId);
        if (sig?.signatureDataUrl) {
          mappedRecord.userSignatureDataUrl = sig.signatureDataUrl;
        }
      }
    } catch (e) {
      // Signature not available, that's ok
    }
    
    setHistoryPreviewRecord(mappedRecord);
    setHistoryPreviewVisible(true);
    try {
      let nextRecord = mappedRecord;
      if (selectedLanguage && selectedLanguage !== "vi" && onTranslateTicketData) {
        nextRecord = await onTranslateTicketData(mappedRecord, { showLoading: true });
        nextRecord = {
          ...(nextRecord || {}),
          userSignatureDataUrl: mappedRecord.userSignatureDataUrl,
        };
      }
      setHistoryPreviewRecord(nextRecord || mappedRecord);
    } catch (e) {
      message.error("Lỗi dịch phiếu");
    } 
  };

  const handleCloseHistoryPreview = (force = false) => {
    if (printingFromPreview && !force) return;
    setHistoryPreviewVisible(false);
    setHistoryPreviewRecord(null);
  };

  const handleOpenHistoryTimeline = async (record) => {
    setHistoryTimelineRecord(record || null);
    setHistoryTimelineVisible(true);
    setHistoryTimelineLoading(true);
    setHistoryTimelineEntries([]);
    try {
      const entries = await Api.getHistoryTimeline(record?._id || record?.id || "");
      setHistoryTimelineEntries(entries || []);
    } catch (e) {
      setHistoryTimelineEntries([]);
      message.error("Không tải được timeline");
    } finally {
      setHistoryTimelineLoading(false);
    }
  };

  const handleCloseHistoryTimeline = () => {
    setHistoryTimelineVisible(false);
    setHistoryTimelineRecord(null);
    setHistoryTimelineEntries([]);
  };

  const formatAuditLabel = (field) => {
    const map = {
      soPhieu: "Số phiếu",
      ngay: "Ngày",
      khachHang: "Khách hàng",
      diaChi: "Địa chỉ",
      nguoiThucHien: "Người thực hiện",
      nguoiLienHe: "Người liên hệ",
      phone: "SĐT / Email",
      phiDichVu: "Phí dịch vụ",
      tinhTrang: "Tình trạng",
      phuongAnXuLy: "Phương án xử lý",
      phuongAnXuLyHtml: "Phương án xử lý",
      ketQua: "Kết quả",
      ketQuaHtml: "Kết quả",
      rating: "Đánh giá",
      status: "Trạng thái phiếu",
      followers: "Người theo dõi",
      loaiPhieu: "Loại phiếu",
      printed: "Trạng thái in",
      nguoiInPhieu: "Người in phiếu",
      updatedBy: "Người cập nhật",
    };
    return map[field] || field;
  };

  const formatAuditUserName = (value) => {
    const rawValue = String(value || "").trim();
    if (!rawValue) return "Không rõ";
    const performer = getPerformerUser(rawValue);
    if (performer) {
      return String(performer.fullNamePrivate || performer.username || performer.key || rawValue);
    }
    return rawValue;
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const toSafeHtml = (value) => {
    const raw = String(value || "");
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const looksLikeHtml = /<[^>]+>/i.test(trimmed);
    if (looksLikeHtml) return raw;
    return escapeHtml(raw).replace(/\r?\n/g, "<br/>");
  };

  const isHtmlAuditField = (field) =>
    ["phuongAnXuLy", "phuongAnXuLyHtml", "ketQua", "ketQuaHtml"].includes(field);

  const formatAuditChangeValue = (field, value) => {
    if (value === null || value === undefined) return "(Trống)";
    if (["updatedBy", "createdBy", "nguoiThucHien"].includes(field)) {
      return formatAuditUserName(value);
    }
    if (field === "status") {
      return formatTicketStatus(value);
    }
    if (field === "printed") {
      return value ? "Đã in" : "Chưa in";
    }
    if (field === "followers") {
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      const keys = arr
        .map((v) => normalizeFollowerKey(v))
        .filter(Boolean);
      if (keys.length === 0) return "(Trống)";
      const names = keys.map((k) => {
        const u = getUserByKeyOrUsernameLoose(k);
        const displayName = String(u?.fullNamePrivate || u?.username || u?.key || k).trim();
        return displayName || k;
      });
      return names.join(", ");
    }
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return String(value);
      }
    }
    return String(value);
  };

  const renderAuditChanges = (changes) => {
    if (!Array.isArray(changes) || changes.length === 0) {
      return <Typography.Text type="secondary">Không có thay đổi chi tiết.</Typography.Text>;
    }
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {changes.map((change, idx) => (
          <div key={`${change.field}-${idx}`} style={{ padding: "10px", borderRadius: 8, background: "#fafafa", border: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{formatAuditLabel(change.field)}</div>
            <div style={{ color: "#555", marginTop: 4 }}>
              {isHtmlAuditField(change.field) ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: toSafeHtml(change.newValue),
                  }}
                />
              ) : (
                <div>{formatAuditChangeValue(change.field, change.newValue)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getPerformerDisplayName = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const normalized = raw.toLowerCase();
    const matched = (users || []).find((u) => {
      const key = String(u?.key || "").trim();
      const username = String(u?.username || "").trim();
      const fullName = String(u?.fullNamePrivate || "").trim();
      const email = String(u?.email || "").trim();
      return (
        (key && key.toLowerCase() === normalized) ||
        (username && username.toLowerCase() === normalized) ||
        (fullName && fullName.toLowerCase() === normalized) ||
        (email && email.toLowerCase() === normalized)
      );
    });
    return matched?.fullNamePrivate || matched?.username || matched?.key || raw;
  };

  const handleDownloadWithTracking = async (record) => {
    const recordId = String(record?._id || record?.id || record?.soPhieu || "");
    setDownloadingRecords((prev) => new Set([...prev, recordId]));
    try {
      let downloadRecord = record;
      const missingHeavyFields =
        downloadRecord?.phuongAnXuLyHtml === undefined ||
        downloadRecord?.ketQuaHtml === undefined ||
        downloadRecord?.phuongAnXuLy === undefined ||
        downloadRecord?.ketQua === undefined;
      const recordKey = String(downloadRecord?._id || downloadRecord?.id || "").trim();
      if (missingHeavyFields && recordKey) {
        try {
          const fullRecord = await Api.getHistoryById(recordKey);
          if (fullRecord) {
            downloadRecord = { ...downloadRecord, ...fullRecord };
          }
        } catch (e) {
          // Nếu không lấy được dữ liệu đầy đủ, vẫn dùng record hiện tại.
        }
      }
      await handleDownloadHistoryRecord(downloadRecord || record);
    } finally {
      setDownloadingRecords((prev) => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  const HistoryTicketPreview = ({ record }) => {
    return <Preview data={record || {}} config={cfg} translations={translations} />;
  };

  const getStatusMeta = (status) => {
    const normalized = normalizeTicketStatus(status);
    const map = {
      new: { color: "#1677ff", bg: "#e6f4ff", border: "#91caff", label: "New" },
      assigned: { color: "#722ed1", bg: "#f9f0ff", border: "#d3adf7", label: "Assigned" },
      in_progress: { color: "#d46b08", bg: "#fff7e6", border: "#ffd591", label: "In Progress" },
      pending: { color: "#08979c", bg: "#e6fffb", border: "#87e8de", label: "Pending" },
      resolved: { color: "#389e0d", bg: "#f6ffed", border: "#b7eb8f", label: "Resolved" },
      closed: { color: "#595959", bg: "#fafafa", border: "#d9d9d9", label: "Closed" },
    };
    return map[normalized] || map.closed;
  };

  return (
    <Card className="panel">
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }} wrap>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Ticket History
        </Typography.Title>
      </Space>

      <Space style={{ width: "100%", marginBottom: 12 }} wrap>
        <Input.Search
          placeholder="Tìm số phiếu / khách hàng / địa chỉ / người thực hiện / tình trạng"
          allowClear
          value={historyKeyword}
          onChange={(e) => {
            const next = e.target.value;
            setHistoryKeyword(next);
            if (historyKeywordDebounceRef?.current) clearTimeout(historyKeywordDebounceRef.current);
            if (historyKeywordDebounceRef) {
              historyKeywordDebounceRef.current = setTimeout(() => {
                handleApplyHistoryFilters({ keyword: next });
              }, 450);
            }
          }}
          onSearch={(val) => handleApplyHistoryFilters({ keyword: val })}
          style={{ width: 320, minWidth: 200 }}
        />

        <DatePicker.RangePicker
          value={historyFrom || historyTo ? [historyFrom, historyTo] : undefined}
          format="DD/MM/YYYY"
          onChange={(dates) => {
            setHistoryFrom(dates?.[0] || null);
            setHistoryTo(dates?.[1] || null);
            handleApplyHistoryFilters({ from: dates?.[0] || null, to: dates?.[1] || null });
          }}
        />

        <Select
          allowClear
          placeholder="Công ty"
          style={{ width: 200, minWidth: 160 }}
          options={Array.from(new Set((customers || []).map((c) => c.companyName)))
            .filter(Boolean)
            .map((c) => ({ label: c, value: c }))}
          showSearch
          onChange={(v) => {
            setHistoryCompany(v);
            handleApplyHistoryFilters({ company: v });
          }}
          value={historyCompany}
        />

        <Select
          allowClear
          placeholder="Trạng thái in"
          style={{ width: 160, minWidth: 140 }}
          options={[
            { label: "Chưa in", value: false },
            { label: "Đã in", value: true },
          ]}
          value={historyPrinted}
          onChange={(v) => {
            setHistoryPrinted(v);
            handleApplyHistoryFilters({ printed: v });
          }}
        />

        <Select
          allowClear
          placeholder="Trạng thái phiếu"
          style={{ width: 170, minWidth: 140 }}
          options={TICKET_STATUS_OPTIONS.map(({ label, value }) => ({ label, value }))}
          value={historyStatus}
          onChange={(v) => {
            temporarilyIgnorePreviewOpen();
            setHistoryStatus(v);
            handleApplyHistoryFilters({ status: v });
          }}
          onOpenChange={() => temporarilyIgnorePreviewOpen()}
        />

        <Segmented
          value={historyLoaiPhieu || "all"}
          options={[
            { label: "Tất cả loại", value: "all" },
            { label: "Incident", value: "incident" },
            { label: "Request", value: "request" },
          ]}
          onChange={(v) => {
            const next = v === "all" ? undefined : v;
            setHistoryLoaiPhieu(next);
            handleApplyHistoryFilters({ loaiPhieu: next });
          }}
        />

        <Select
          allowClear
          placeholder="Người thực hiện"
          style={{ width: 190, minWidth: 160 }}
          showSearch
          optionLabelProp="title"
          options={(users || [])
            .map((u) => {
              const name = u.fullNamePrivate || u.username || u.key;
              const chucVu = u.chucVu || "";
              return {
                title: name,
                label: (
                  <div>
                    <div>{name}</div>
                    {chucVu && <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div>}
                  </div>
                ),
                value: getUserAssignValue(u),
              };
            })
            .filter((o) => o.value)}
          value={historyNguoiThucHien}
          onChange={(v) => {
            setHistoryNguoiThucHien(v);
            handleApplyHistoryFilters({ nguoiThucHien: v });
          }}
        />
                  <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!selectedRowKeys || selectedRowKeys.length === 0}
            onClick={handlePrintSelected}
          >
            In đã chọn ({selectedRowKeys?.length || 0})
          </Button>
          <Button
            icon={<FileTextOutlined />}
            disabled={exportingExcel}
            loading={exportingExcel}
            onClick={handleExportSupportStatsExcel}
          >
            Xuất báo cáo
          </Button>
        <Button onClick={handleResetHistoryFilters} icon={<ReloadOutlined /> } tooltip="Làm mới"/>
        <Button
          type="dashed"
          icon={<EditOutlined />}
          onClick={saveHistoryFiltersForCurrentUser}
          title={hasSavedHistoryFilter ? "Sửa bộ lọc đã lưu" : "Lưu bộ lọc hiện tại"}
        >
          {hasSavedHistoryFilter ? "Edit filter" : "Save filter"}
        </Button>
      </Space>
      <Space style={{ width: "100%", marginBottom: 12 }} wrap>
        <Checkbox
          checked={allSelectedCurrentPage}
          indeterminate={historySelectionIndeterminate}
          onChange={(e) => {
            const currentIds = currentHistoryRowIds || [];
            if (e.target.checked) {
              setSelectedRowKeys((prev) => {
                const base = prev || [];
                const next = [...base];
                currentIds.forEach((id) => {
                  if (!next.includes(id)) next.push(id);
                });
                return next;
              });
            } else {
              setSelectedRowKeys((prev) => (prev || []).filter((id) => !(currentIds || []).includes(id)));
            }
          }}
        >
          Chọn tất cả ({selectedInCurrentPageCount}/{(currentHistoryRowIds || []).length})
        </Checkbox>
      </Space>

      <List
        loading={{
          spinning: historyLoading,
          tip: "Đang tải danh sách...",
        }}
        dataSource={history}
        pagination={{
          pageSize: filters.pageSize || 15,
          current: filters.page || 1,
          total: historyTotal,
          showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} / tổng ${total} phiếu`,
          onChange: (page) => loadHistory({ page }),
          showSizeChanger: false,
        }}
        renderItem={(record) => {
          const recordId = String(record?._id || record?.id || record?.soPhieu);
          const isSelected = (selectedRowKeys || []).includes(recordId);
          const isPrinted = Boolean(record?.printed);
          const tinhTrang = record?.tinhTrang || "Chưa có";
          const tinhTrangText = tinhTrang.length > 140 ? `${tinhTrang.substring(0, 140)}...` : tinhTrang;
          const canEditThis = canEditHistoryRecord(record);
          const followerKeys = getFollowersForRecord(record);
          const followerDisplayItems = followerKeys.map((k) => getFollowerDisplayInfo(k));
          const statusMeta = getStatusMeta(record?.status);
          const itemDate = record?.ngay || record?.createdAt || "";

          return (
            <List.Item style={{ padding: 0, marginBottom: 8 }} key={recordId}>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if (Date.now() < ignorePreviewUntilRef.current) return;
                  const target = e.target;
                  if (!(target instanceof Element)) return;
                  if (
                    target.closest(".history-list-item-actions") ||
                    target.closest(".ant-select") ||
                    target.closest(".ant-btn") ||
                    target.closest(".ant-checkbox-wrapper")
                  ) {
                    return;
                  }
                  handleOpenHistoryPreview(record);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleOpenHistoryPreview(record);
                }}
                className="history-list-item"
                style={{
                  padding: "10px 12px",
                  backgroundColor: isSelected ? "#fff0f0" : "#fff",
                  border: `1px solid ${isSelected ? "#ed3237" : "#f0f0f0"}`,
                  borderRadius: 10,
                  boxShadow: isSelected
                    ? "0 6px 16px rgba(237, 50, 55, 0.1)"
                    : "0 2px 8px rgba(0, 0, 0, 0.04)",
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                <div className="history-list-item-content" style={{ width: "100%" }}>
                  <Checkbox
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      const checked = e.target.checked;
                      setSelectedRowKeys((prev) => {
                        const base = prev || [];
                        if (checked) {
                          if (base.includes(recordId)) return base;
                          return [...base, recordId];
                        }
                        return base.filter((k) => k !== recordId);
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 6,
                          }}
                        >
                          <Tag
                            style={{
                              margin: 0,
                              color: statusMeta.color,
                              background: statusMeta.bg,
                              borderColor: statusMeta.border,
                              fontWeight: 600,
                              fontSize: 11,
                              lineHeight: "16px",
                              padding: "0 6px",
                            }}
                          >
                            {statusMeta.label}
                          </Tag>
                          <Tag
                            color={record?.loaiPhieu === "request" ? "blue" : "red"}
                            style={{ margin: 0, whiteSpace: "nowrap", fontWeight: 600, fontSize: 11, lineHeight: "16px", padding: "0 6px" }}
                          >
                            {record?.loaiPhieu === "request" ? "Request" : "Incident"}
                          </Tag>
                          <Tag
                            color={isPrinted ? "green" : "default"}
                            style={{ margin: 0, whiteSpace: "nowrap", fontWeight: 600, fontSize: 11, lineHeight: "16px", padding: "0 6px" }}
                          >
                            {isPrinted ? "Đã in" : "Chưa in"}
                          </Tag>
                        </div>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "#1f1f1f",
                            lineHeight: 1.35,
                            minWidth: 0,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                          title={tinhTrang}
                        >
                          {tinhTrangText}
                        </div>
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 1 }}
                        title={followerKeys.length > 0 ? `Người theo dõi: ${followerKeys.length}` : "Chưa có người theo dõi"}
                      >
                        <Avatar.Group
                          maxCount={3}
                          size="small"
                          maxStyle={{ color: "#fff", backgroundColor: "#999" }}
                        >
                          {followerDisplayItems.map((item) => (
                            <Popover
                              key={item.rawValue || item.displayName}
                              content={item.tooltip}
                              placement="top"
                            >
                              <UserAvatar
                                name={item.displayName}
                                style={{ fontSize: 11 }}
                              />
                            </Popover>
                          ))}
                        </Avatar.Group>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                        Số phiếu
                        <div style={{ fontSize: 12, color: "#262626", fontWeight: 600, marginTop: 1 }}>
                          {record?.soPhieu || "(Chưa có)"}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                        Ngày
                        <div style={{ fontSize: 12, color: "#262626", fontWeight: 600, marginTop: 1 }}>
                          {itemDate || "(Chưa có)"}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                        Khách hàng
                        <div
                          style={{
                            fontSize: 12,
                            color: "#262626",
                            fontWeight: 600,
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={record?.khachHang || ""}
                        >
                          {record?.khachHang || "(Chưa có)"}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "#8c8c8c" }}>
                        Người thực hiện
                        <div
                          style={{
                            fontSize: 12,
                            color: "#262626",
                            fontWeight: 600,
                            marginTop: 1,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={getPerformerDisplayName(record?.nguoiThucHien) || ""}
                        >
                          {getPerformerDisplayName(record?.nguoiThucHien) || "(Chưa có)"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Space size="small" className="history-list-item-actions" onClick={(e) => e.stopPropagation()} align="end" style={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      icon={<HistoryOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenHistoryTimeline(record);
                      }}
                    >
                      Timeline
                    </Button>
                    {canEditThis && (
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFollowersModal(record);
                        }}
                      >
                        Theo dõi
                      </Button>
                    )}
                    <Button size="small" icon={<CloudDownloadOutlined />} loading={downloadingRecords.has(recordId)} onClick={() => handleDownloadWithTracking(record)}>
                      Tải xuống file
                    </Button>
                    {canEditThis && (
                      <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEditHistory(record)}>
                        Sửa
                      </Button>
                    )}
                    {canManagePermission && (
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={!record?._id && !record?.id}
                        onClick={() => handleDeleteHistory(record?._id || record?.id, record?.soPhieu)}
                      >
                        Xóa
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            </List.Item>
          );
        }}
      />

      <Modal
        open={historyPreviewVisible}
        title={`In phiếu ${historyPreviewRecord?.soPhieu || ""}`}
        onCancel={handleCloseHistoryPreview}
        maskClosable={!printingFromPreview}
        closable={!printingFromPreview}
        footer={[
          <Button key="download" icon={<CloudDownloadOutlined />} loading={downloadingRecords.has(String(historyPreviewRecord?._id || historyPreviewRecord?.id || historyPreviewRecord?.soPhieu))} onClick={() => historyPreviewRecord && handleDownloadWithTracking(historyPreviewRecord)}>
            Tải xuống file
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            loading={printingFromPreview}
            onClick={async () => {
              if (!historyPreviewRecord || printingFromPreview) return;
              setPrintingFromPreview(true);
              try {
                const ok = await handlePrintHistoryRecord(historyPreviewRecord);
                if (ok) handleCloseHistoryPreview(true);
              } finally {
                setPrintingFromPreview(false);
              }
            }}
          >
            In
          </Button>,
          <Button key="close" onClick={handleCloseHistoryPreview} disabled={printingFromPreview}>
            Đóng
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
        {/* {previewLoading ? "Đang tải bản dịch..." : <HistoryTicketPreview record={historyPreviewRecord || {}} />} */}
        <HistoryTicketPreview record={historyPreviewRecord || {}} />
      </Modal>

      <Drawer
        title={`Timeline phiếu ${historyTimelineRecord?.soPhieu || ""}`}
        placement="right"
        width={560}
        open={historyTimelineVisible}
        onClose={handleCloseHistoryTimeline}
        destroyOnClose
      >
        <div style={{ display: "grid", gap: 16 }}>

          <Timeline mode="left">
            {historyTimelineLoading ? (
              <Timeline.Item color="gray">
                <Typography.Text>Đang tải timeline...</Typography.Text>
              </Timeline.Item>
            ) : historyTimelineEntries.length > 0 ? (
              historyTimelineEntries.map((item, idx) => (
                <Timeline.Item key={`timeline-${idx}`} color={item.type === "created" ? "blue" : "green"}>
                  <div style={{ fontWeight: 600 }}>{item.type === "created" ? "Tạo phiếu" : "Cập nhật"}</div>
                  <div>Bởi: {formatAuditUserName(item.by || historyTimelineRecord?.createdBy || "Không rõ")}</div>
                  <div>Lúc: {item.timestamp ? new Date(item.timestamp).toLocaleString("vi-VN") : "Không có"}</div>
                  {item.type === "updated" && (
                    <div style={{ marginTop: 8 }}>{renderAuditChanges(item.changes)}</div>
                  )}
                </Timeline.Item>
              ))
            ) : (
              <Timeline.Item color="gray">
                <Typography.Text type="secondary">Không có dữ liệu timeline.</Typography.Text>
              </Timeline.Item>
            )}
          </Timeline>
        </div>
      </Drawer>

      <Modal
        title="Xác nhận in hàng loạt"
        open={confirmPrintModalVisible}
        onOk={handleConfirmPrintSelected}
        onCancel={() => setConfirmPrintModalVisible(false)}
        okText="Đồng ý"
        cancelText="Hủy"
        destroyOnClose
      >
        <p>Bạn có chắc chắn muốn in {selectedRowKeys.length} phiếu đã chọn?</p>
      </Modal>

      <Modal
        title="Tiến trình in hàng loạt"
        open={progressModalVisible}
        closable={printProgress.current >= printProgress.total}
        maskClosable={printProgress.current >= printProgress.total}
        onCancel={() => {
          if (printProgress.current < printProgress.total) handleCancelBatchPrint();
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setProgressModalVisible(false)} disabled={printProgress.current < printProgress.total}>
            Đóng
          </Button>,
          printProgress.current < printProgress.total && (
            <Button key="cancel" onClick={() => handleCancelBatchPrint()}>
              Hủy
            </Button>
          ),
        ].filter(Boolean)}
      >
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={printProgress.total > 0 ? Math.round((printProgress.current / printProgress.total) * 100) : 0}
            status={printProgress.current >= printProgress.total ? "success" : "active"}
          />
          <div style={{ marginTop: 8, textAlign: "center", color: "#666" }}>
            Đã xử lý: {printProgress.current} / {printProgress.total}
          </div>
        </div>
        

        {printProgress.success.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ color: "#52c41a" }}>
              Thành công ({printProgress.success.length}):
            </Typography.Text>
            <div style={{ marginTop: 8, maxHeight: 150, overflowY: "auto" }}>
              {printProgress.success.map((soPhieu, idx) => (
                <div key={`${soPhieu}-${idx}`} style={{ padding: "4px 0", color: "#52c41a" }}>
                  ✓ {soPhieu}
                </div>
              ))}
            </div>
          </div>
        )}

        {printProgress.failed.length > 0 && (
          <div>
            <Typography.Text strong style={{ color: "#ff4d4f" }}>
              Thất bại ({printProgress.failed.length}):
            </Typography.Text>
            <div style={{ marginTop: 8, maxHeight: 150, overflowY: "auto" }}>
              {printProgress.failed.map((item, idx) => (
                <div key={`${item.soPhieu}-${idx}`} style={{ padding: "4px 0", color: "#ff4d4f" }}>
                  ✗ {item.soPhieu} - {item.reason}
                </div>
              ))}
            </div>
          </div>
        )}

         <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#e6f7ff", border: "1px solid #91d5ff" }}>
                <Typography.Text style={{ fontSize: 12, color: "#0c5aa0" }}>
                  <strong>Lưu ý:</strong> Vui lòng không đóng cửa sổ này cho đến khi tiến trình hoàn tất để đảm bảo tất cả phiếu được in thành công.
                </Typography.Text>
              </div>
      </Modal>
      

      <Modal
        title={`Assign Phiếu ${assignModalRecord?.soPhieu || ""}`}
        open={assignModalVisible}
        onCancel={closeAssignModal}
        onOk={async () => {
          const performerUser = getPerformerUser(assignModalPerformer);
          const resolvedPerformer = String(
            performerUser?.key || performerUser?.username || assignModalPerformer || ""
          ).trim();
          if (!resolvedPerformer) {
            message.error("Vui lòng chọn người thực hiện");
            return;
          }
          await handleOpenEditHistory(assignModalRecord, "assigned");
          historyEditForm.setFieldsValue({ nguoiThucHien: resolvedPerformer });
          closeAssignModal();
        }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <Form layout="vertical">
          <Form.Item label="Người thực hiện">
            <Select
              showSearch
              optionLabelProp="title"
              placeholder="Chọn người thực hiện"
              value={assignModalPerformer}
              onChange={(v) => setAssignModalPerformer(v)}
              options={(users || [])
                .map((u) => {
                  const name = u.fullNamePrivate || u.username || u.key;
                  const chucVu = u.chucVu || "";
                  return {
                    title: name,
                    label: (
                      <div>
                        <div>{name}</div>
                        {chucVu && <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div>}
                      </div>
                    ),
                    value: getUserAssignValue(u),
                  };
                })
                .filter((o) => o.value)}
            />
          </Form.Item>
          <Form.Item>
            <Typography.Text type="secondary">
              Chọn người thực hiện trước khi xác nhận chuyển trạng thái Assigned.
            </Typography.Text>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Người theo dõi phiếu ${followersModalRecord?.soPhieu || ""}`}
        open={followersModalVisible}
        onCancel={closeFollowersModal}
        onOk={handleSaveFollowers}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="Chọn người theo dõi">
            <Select
              mode="multiple"
              allowClear
              showSearch
              placeholder="Chọn người theo dõi"
              value={followersModalValue}
              onChange={(vals) => setFollowersModalValue(vals || [])}
              optionLabelProp="title"
              options={(users || [])
                .map((u) => {
                  const key = String(u?.key || u?.username || "").trim();
                  const value = normalizeFollowerKey(key);
                  const name = String(u?.fullNamePrivate || u?.username || u?.key || "").trim();
                  const chucVu = String(u?.chucVu || "").trim();
                  return {
                    title: name,
                    label: (
                      <div>
                        <div>{name}</div>
                        {chucVu && <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div>}
                      </div>
                    ),
                    value,
                  };
                })
                .filter((o) => o.value)
                .filter((o) => {
                  const performerKey = normalizeFollowerKey(
                    followersModalRecord?.nguoiThucHien || ""
                  );
                  if (!performerKey) return true;
                  return o.value !== performerKey;
                })}
            />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Người thực hiện sẽ được tự động theo dõi phiếu này.
          </Typography.Text>
        </Form>
      </Modal>

      <Drawer
        title={`Sửa Phiếu ${historyEditRecord?.soPhieu || ""}`}
        placement="right"
        width={860}
        open={!!historyEditRecord}
        onClose={() => {
          setHistoryEditRecord(null);
          historyEditForm.resetFields();
        }}
        destroyOnClose
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button
              onClick={() => {
                setHistoryEditRecord(null);
                historyEditForm.resetFields();
              }}
            >
              Hủy
            </Button>
            <Button type="primary" onClick={() => historyEditForm.submit()}>
              Lưu
            </Button>
          </div>
        }
      >
        <Form form={historyEditForm} layout="vertical" onFinish={handleSaveEditHistory}>
          <div style={{ marginBottom: 8 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Thông tin cơ bản
            </Typography.Title>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Form.Item label="Số phiếu" name="soPhieu">
              <Input disabled />
            </Form.Item>
            <Form.Item label="Ngày" name="ngay" rules={[{ required: true, message: "Chọn ngày" }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="Trạng thái phiếu" name="status">
              <Select
                options={TICKET_STATUS_OPTIONS.map(({ label, value }) => ({ label, value }))}
                disabled={!canEditHistoryRecord(historyEditRecord)}
              />
            </Form.Item>
            <Form.Item label="Loại phiếu" name="loaiPhieu">
              <Segmented
                options={[
                  { label: "Incident", value: "incident" },
                  { label: "Request", value: "request" },
                ]}
                block
                disabled={!canEditHistoryRecord(historyEditRecord)}
              />
            </Form.Item>
          </div>

          <div style={{ margin: "16px 0 8px" }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Khách hàng và liên hệ
            </Typography.Title>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Form.Item
              label="Khách hàng"
              name="khachHang"
              rules={[{ required: true, message: "Chọn khách hàng" }]}
              style={{ gridColumn: "1 / -1" }}
            >
              <Select
                showSearch
                allowClear
                options={Array.from(new Set((customers || []).map((c) => c.companyName))).map((c) => ({ label: c, value: c }))}
                onChange={(val) => {
                  if (!val) return;
                  const first = (customers || []).find((c) => c.companyName === val);
                  if (!first) return;
                  historyEditForm.setFieldsValue({
                    diaChi: first.address || "",
                    nguoiLienHe: first.name || "",
                    phone: first.phone || "",
                  });
                }}
              />
            </Form.Item>
            <Form.Item label="Người liên hệ" name="nguoiLienHe">
              <Input placeholder="Nhập người liên hệ" />
            </Form.Item>
            <Form.Item label="SĐT / Email" name="phone">
              <Input placeholder="Nhập SĐT hoặc Email" />
            </Form.Item>
            <Form.Item label="Địa chỉ" name="diaChi" style={{ gridColumn: "1 / -1" }}>
              <Input.TextArea rows={2} placeholder="Nhập địa chỉ" />
            </Form.Item>
          </div>

          <div style={{ margin: "16px 0 8px" }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Xử lý và kết quả
            </Typography.Title>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <Form.Item shouldUpdate={(prev, cur) => prev.status !== cur.status} noStyle>
              {({ getFieldValue }) =>
                normalizeTicketStatus(getFieldValue("status")) === "assigned" ? (
                  <Form.Item label="Người thực hiện" name="nguoiThucHien" rules={[{ required: true }]}>
                    <Select
                      showSearch
                      allowClear
                      optionLabelProp="title"
                      options={(users || [])
                        .map((u) => {
                          const name = u.fullNamePrivate || u.username || u.key;
                          const chucVu = u.chucVu || "";
                          return {
                            title: name,
                            label: (
                              <div>
                                <div>{name}</div>
                                {chucVu && <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div>}
                              </div>
                            ),
                            value: getUserAssignValue(u),
                          };
                        })
                        .filter((o) => o.value)}
                      disabled={!canEditHistoryRecord(historyEditRecord)}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Form.Item label="Phí dịch vụ" name="phiDichVu">
              <Input placeholder="0" />
            </Form.Item>
            <Form.Item label="Đánh giá (0-5)" name="rating">
              <Input type="number" min={0} max={5} />
            </Form.Item>
          </div>

          <Form.Item label="1. Tình trạng" name="tinhTrang">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="2. Phương án xử lý" name="phuongAnXuLy">
            <CkEditor
              name="phuongAnXuLy"
              form={historyEditForm}
              disabled={!canEditHistoryRecord(historyEditRecord)}
              initialValue={historyEditRecord?.phuongAnXuLyHtml || historyEditRecord?.phuongAnXuLy || ""}
              placeholder="Nhập phương án xử lý..."
            />
          </Form.Item>
          <Form.Item name="phuongAnXuLyHtml" style={{ display: "none" }}>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item label="3. Kết quả" name="ketQua">
            <CkEditor
              name="ketQua"
              form={historyEditForm}
              disabled={!canEditHistoryRecord(historyEditRecord)}
              initialValue={historyEditRecord?.ketQuaHtml || historyEditRecord?.ketQua || ""}
              placeholder="Nhập kết quả..."
            />
          </Form.Item>
          <Form.Item name="ketQuaHtml" style={{ display: "none" }}>
            <Input type="hidden" />
          </Form.Item>

        </Form>
      </Drawer>
    </Card>
  );
}

