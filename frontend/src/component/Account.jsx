import React, { useState } from "react";
import { Badge, Button, Card, Form, Input, Drawer, Select, Space, Table, Typography, Popover, Empty } from "antd";
import { DeleteOutlined, EditOutlined, ReloadOutlined, PlusOutlined, LogoutOutlined } from "@ant-design/icons";

// AccountTab (web): UI-only component. All persistence is handled by callbacks from App.js.
export default function AccountTab({
  users = [],
  loading,
  filter,
  canManagePermission,
  permissionLabels,
  onEdit,
  onTogglePermission,
  onDelete,
  onRemoteLogout,
  usersFilter,
  setUsersFilter,
  loadUsers,
  setUsersDrawerVisible,
  userStatus = {},
  customers = [],
}) {
    const [editForm] = Form.useForm();
    const [editing, setEditing] = useState(null);

  const normalizePermissionValues = (record) => {
    const canManageBool = record?.canManage === true || record?.canManage === "true";
    const canManageString = record?.canManage === "Chỉnh sửa";
    const canEditBool = record?.canEdit === true || record?.canEdit === "true";
    const isCustomer = record?.customerRole === true || record?.customerRole === "true";
    if (isCustomer) return "customer";
    if (canManageBool) return "manage";
    if (canManageString || canEditBool) return "edit";
    return "none";
  };

    const filteredUsers = filter
    ? (users || []).filter(
        (u) =>
          u.username?.toLowerCase().includes(filter.toLowerCase()) ||
          u.key?.toLowerCase().includes(filter.toLowerCase()) ||
          u.fullNamePrivate?.toLowerCase().includes(filter.toLowerCase())
      )
    : users || [];

    const columns = [
      { title: "User", dataIndex: "username", key: "username" },
      { title: "Họ tên riêng", dataIndex: "fullNamePrivate", key: "fullNamePrivate" },
      { title: "Chức vụ", dataIndex: "chucVu", key: "chucVu" },
      {
        title: "Hoạt động",
        key: "status",
        render: (_v, record) => {
          // Try to match with both id and key fields since backend might use either
          const userId = String(record.id || record._id || "").trim();
          const userKey = String(record.key || "").trim();
          
          // Check if user is online using userId or key
          const isOnline = (userStatus && (userStatus[userId] === "online" || userStatus[userKey] === "online"));
          
          if (!isOnline && (userId || userKey)) {
            console.log(`[Account] Checking status for user: id="${userId}", key="${userKey}":`, {
              userStatus,
              isOnline,
            });
          }
          
          return (
            <Space size="small">
              <Badge 
                status={isOnline ? "success" : "default"}
                text={isOnline ? "Online" : "Offline"}
              />
            </Space>
          );
        },
      },
      {
        title: "Quyền",
        key: "permission",
        render: (_v, record) => {
        const currentValue = normalizePermissionValues(record);
          return (
            <Select
              value={currentValue}
            disabled={!canManagePermission}
            onChange={(val) => onTogglePermission?.(record, val)}
              size="small"
              style={{ width: 150 }}
              options={[
              { label: permissionLabels?.noneLabel || "Không có quyền", value: "none" },
              { label: permissionLabels?.editLabel || "Chỉnh sửa", value: "edit" },
              { label: permissionLabels?.manageLabel || "Quản lý", value: "manage" },
              // { label: permissionLabels?.customerLabel || "Khách hàng", value: "customer" },
              ]}
            />
          );
        },
      },
      {
        title: "Thao tác",
        key: "actions",
        render: (_v, record) => {
          const userId = String(record.id || record._id || "").trim();
          const userKey = String(record.key || "").trim();
          const isOnline = !!(userStatus && (userStatus[userId] === "online" || userStatus[userKey] === "online"));

          return (
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  const permission = normalizePermissionValues(record);
                  setEditing(record);
                  editForm.setFieldsValue({
                    key: record.key,
                    fullNamePrivate: record.fullNamePrivate || "",
                    password: "",
                    ...(canManagePermission ? { permission } : {}),
                    chucVu: record.chucVu || "",
                    ...(permission === "customer" && record.assignedCustomer ? { assignedCustomer: record.assignedCustomer } : {}),
                  });
                }}
              >
                Sửa
              </Button>
              <Button
                size="small"
                icon={<LogoutOutlined />}
                disabled={!canManagePermission || !isOnline || String(record?.username || "").trim().toLowerCase() === "admin"}
                onClick={() => onRemoteLogout?.(record)}
              >
                Logout từ xa
              </Button>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={record.username === "admin"}
                onClick={() => onDelete?.(record.id || record._id, record.username)}
              >
                Xóa
              </Button>
            </Space>
          );
        },
      },
    ];

    return (
    <Card className="panel">
      <div className="panel-toolbar" style={{ marginBottom: 12, marginTop: 16, justifyContent: "flex-start" }}>
        <Input.Search
          className="panel-search"
          placeholder="Tìm username / họ tên"
          allowClear
          value={usersFilter}
          onChange={(e) => setUsersFilter(e.target.value)}
          style={{ width: 300, minWidth: "200px", marginRight: "auto" }}
        />
        <Space wrap>
          <Popover content="Làm mới">
            <Button onClick={() => loadUsers()} icon={<ReloadOutlined />} />
          </Popover>
          <Button type="primary" onClick={() => setUsersDrawerVisible(true)} icon={<PlusOutlined />}>
            Thêm tài khoản
          </Button>
        </Space>
      </div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Quản lý tài khoản
      </Typography.Title>

          <Table
            className="responsive-table"
            size="small"
            loading={loading}
            columns={columns}
             scroll={{ x: true }}
          style={{ width: '100%', whiteSpace: 'nowrap' }}
        dataSource={(filteredUsers || []).map((u, idx) => ({
          ...u,
          key: `${u.id || u._id || "user-" + idx}-${idx}`,
        }))}
            pagination={{ pageSize: 15, showSizeChanger: false }}
          locale={{
            emptyText: <Empty description="Không có dữ liệu" />,
          }}
          bordered
          />

        <Drawer
          open={!!editing}
          title={`Sửa tài khoản ${editing?.username || ""}`}
          onClose={() => setEditing(null)}
          destroyOnClose
          width={500}
          footer={
            <Space style={{ float: "right" }}>
              <Button onClick={() => setEditing(null)}>Hủy</Button>
              <Button type="primary" onClick={() => editForm.submit()}>Sửa</Button>
            </Space>
          }
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={(vals) => {
            const editId = editing?.id || editing?._id;
            if (!editId) return;

              let updatedVals = { ...vals };
            if (canManagePermission && vals.permission !== undefined) {
                const permission = vals.permission || "none";
                let newCanManage = false;
                let newCanEdit = false;
                let newCustomerRole = false;
                if (permission === "manage") {
                newCanManage = true;
                  newCanEdit = true;
                } else if (permission === "edit") {
                newCanManage = "Chỉnh sửa";
                  newCanEdit = true;
                } else if (permission === "customer") {
                  newCustomerRole = true;
                }
              updatedVals = { ...vals, canManage: newCanManage, canEdit: newCanEdit, customerRole: newCustomerRole };
            }
            delete updatedVals.permission;
            onEdit?.(String(editId), updatedVals);
              setEditing(null);
            }}
          >
            <Form.Item label="Họ tên riêng" name="fullNamePrivate">
              <Input />
            </Form.Item>
            <Form.Item label="Mật khẩu mới" name="password">
              <Input.Password />
            </Form.Item>
            <Form.Item label="Chức vụ" name="chucVu">
              <Input placeholder="Nhập chức vụ" />
            </Form.Item>
          {canManagePermission && (
              <Form.Item label="Quyền" name="permission">
                <Select
                  options={[
                  { label: permissionLabels?.noneLabel || "Không có quyền", value: "none" },
                  { label: permissionLabels?.editLabel || "Chỉnh sửa", value: "edit" },
                  { label: permissionLabels?.manageLabel || "Quản lý", value: "manage" },
                  { label: permissionLabels?.customerLabel || "Khách hàng", value: "customer" },
                  ]}
                />
              </Form.Item>
            )}
            {canManagePermission && editForm.getFieldValue("permission") === "customer" && (
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
          </Form>
        </Drawer>
    </Card>
    );
}

