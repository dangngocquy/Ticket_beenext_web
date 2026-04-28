import React from "react";
import { Button, Popover, Space } from "antd";
import { LogoutOutlined, LockOutlined, TeamOutlined, CaretDownOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Logo from "../asset/logo.png";
import UserAvatar from "./UserAvatar";
import NotificationPopover from "./NotificationPopover";

export default function Header({
  authUser,
  onLogout,
  onOpenChangePassword,
  mobileMenuButton,
  notifications = [],
  unreadNotificationCount = 0,
  onMarkNotificationRead,
  notificationsLoading = false,
  notificationsHasMore = false,
  onLoadMoreNotifications,
}) {
  const navigate = useNavigate();
  const user = authUser;

  const handleLogout = () => {
    onLogout?.();
    navigate("/login", { replace: true });
  };

  const handleLogoClick = () => {
    navigate("/app/form", { replace: true });
  };

  const popoverContent = (
    <div style={{ minWidth: 220, width: "min(90vw, 320px)", maxWidth: "90vw", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        {/* <Avatar size={40} style={{ backgroundColor: "#ed3237", flexShrink: 0 }}>
          {(user?.fullNamePrivate || user?.username || "U").charAt(0).toUpperCase()}
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.fullNamePrivate || user?.username || "User"}
          </div>
          {user?.chucVu ? (
            <div style={{ color: "#888", fontSize: 12 }}>{user.chucVu}</div>
          ) : null}
        </div> */}
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={4}>
       <Button
            type="text"
            block
            icon={<TeamOutlined />}
            onClick={() =>
              window.open(
                "https://docs.google.com/spreadsheets/d/1cJdpxueGwI26BF5xMNG1dNVBnJQAEtZ3O-oLbmkT3Ao/edit?gid=1555812772#gid=1555812772",
                "_blank"
              )
            }
          >
            Quản lý tài khoản (Helpdesk)
          </Button>
        <Button type="text" block icon={<LockOutlined />} onClick={onOpenChangePassword}>
          Đổi mật khẩu
        </Button>
        <Button type="text" danger block icon={<LogoutOutlined />} onClick={handleLogout}>
          Đăng xuất
        </Button>
      </Space>
    </div>
  );

  return (
    <div
      style={{
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        borderBottom: "1px solid #f0f0f0",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {mobileMenuButton}
        <img 
          src={Logo} 
          alt="Bee-Next" 
          style={{ height: 28, cursor: "pointer" }}
          onClick={handleLogoClick}
        />
      </div>

      <div style={{ cursor: "pointer" }}>
        <Space size={8} align="center">
          <NotificationPopover
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            onMarkNotificationRead={onMarkNotificationRead}
            notificationsLoading={notificationsLoading}
            notificationsHasMore={notificationsHasMore}
            onLoadMoreNotifications={onLoadMoreNotifications}
          />
          |
          <Popover
            content={popoverContent}
            placement="bottomRight"
            trigger="click"
            getPopupContainer={(node) => node?.parentElement || document.body}
            overlayStyle={{ maxWidth: "90vw", width: "auto" }}
          >
            <Space size={8} align="center">
            <UserAvatar
              size="small"
              name={user?.fullNamePrivate || user?.username || user?.key || "U"}
            />
            <div className="user-info">
                          <div className="user-greeting-name">
                            Xin chào, <span className="user-name-inline">{user?.fullNamePrivate || user?.username}</span>
                          </div>
                        </div>
            <span style={{ fontSize: 12, color: "#666" }}><CaretDownOutlined/></span>
            </Space>
          </Popover>
        </Space>
      </div>
    </div>
  );
}

