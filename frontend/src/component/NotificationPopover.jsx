import React from "react";
import { Button, Popover, Space, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Badge } from "antd";

export default function NotificationPopover({
  notifications = [],
  unreadNotificationCount = 0,
  onMarkNotificationRead,
  notificationsLoading = false,
  notificationsHasMore = false,
  onLoadMoreNotifications,
}) {
  const truncateText = (value, maxLength = 80) => {
    const text = String(value || "").trim();
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength - 1).trim()}…`;
  };

  const notificationContent = (
    <div
      style={{ minWidth: 220, maxWidth: "90vw", maxHeight: 360, overflowY: "auto", boxSizing: "border-box" }}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (!el) return;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        if (nearBottom && notificationsHasMore && !notificationsLoading) {
          onLoadMoreNotifications?.();
        }
      }}
    >
      {(notifications || []).length === 0 ? (
        <Typography.Text type="secondary">Chưa có thông báo</Typography.Text>
      ) : (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {(notifications || []).map((n) => (
            <div
              key={n.id}
              role="button"
              tabIndex={0}
              onClick={() => onMarkNotificationRead?.(n.id, n)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onMarkNotificationRead?.(n.id, n);
              }}
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                padding: 10,
                background: n.read ? "#fff" : "linear-gradient(135deg, rgba(237, 50, 55, 0.082) 0%, rgba(237, 50, 55, 0.03) 100%)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {n.title ||
                  (n.type === "ticket-followed"
                    ? (n.soPhieu
                      ? `${n.actorName || "Ai đó"} đã gắn bạn theo dõi phiếu ${n.soPhieu}`
                      : `${n.actorName || "Ai đó"} đã gắn bạn theo dõi 1 phiếu`)
                    : n.type === "ticket-followed-update"
                      ? (n.soPhieu ? `Phiếu ${n.soPhieu} bạn theo dõi đã thay đổi` : "Phiếu bạn theo dõi đã thay đổi")
                      : (n.soPhieu ? `Bạn có phiếu cần xử lý: ${n.soPhieu}` : "Bạn có phiếu cần xử lý"))}
              </div>
              <div style={{ fontSize: 12, color: "#666", whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word" }}>
                {n.type === "ticket-followed-update"
                  ? `Người thay đổi: ${n.actorName || "Không rõ"}`
                  : n.type === "ticket-followed"
                    ? `Người gắn theo dõi: ${n.actorName || "Không rõ"}`
                    : `Từ: ${n.assignedByName || "Không rõ"}`}
                {n.status ? ` • Trạng thái: ${truncateText(n.status, 120)}` : ""}
              </div>
              {n.message ? (
                <div style={{ fontSize: 12, color: "#888", marginTop: 2, whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word" }}>
                  {n.message}
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                {new Date(n.createdAt || Date.now()).toLocaleString("vi-VN")}
              </div>
              {!n.read ? (
                <div style={{ marginTop: 4, fontSize: 11, color: "#ed3237" }}>Nhấn để đánh dấu đã đọc</div>
              ) : null}
            </div>
          ))}
        </Space>
      )}
      {notificationsLoading ? (
        <div style={{ marginTop: 8, textAlign: "center", color: "#888", fontSize: 12 }}>Đang tải thêm...</div>
      ) : null}
    </div>
  );

  return (
    <Popover
      content={notificationContent}
      placement="bottomRight"
      trigger="click"
      getPopupContainer={(node) => node?.parentElement || document.body}
      overlayStyle={{ maxWidth: "90vw", width: "auto" }}
    >
      <Badge count={unreadNotificationCount} size="small">
        <Button
          type="text"
          icon={<BellOutlined />}
        />
      </Badge>
    </Popover>
  );
}