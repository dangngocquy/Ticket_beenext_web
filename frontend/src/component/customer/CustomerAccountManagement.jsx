import React, { useState } from "react";
import { Badge, Button, Card, Form, Input, Drawer, Space, Table, Typography, Popover, Empty } from "antd";
import { DeleteOutlined, EditOutlined, ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import CustomerAccountCreation from "./CustomerAccountCreation";

// CustomerAccountManagement: Shows users assigned to the same customer
export default function CustomerAccountManagement({
  users = [],
  loading = false,
  currentUser = {},
  selectedCustomerId = null,
  customers = [],
  userStatus = {},
  onEdit,
  onDelete,
  onReload,
  onAddAccount,
  addAccountVisible,
  setAddAccountVisible,
  addAccountLoading,
}) {
  const [editForm] = Form.useForm();
  const [editing, setEditing] = useState(null);
  const [usersFilter, setUsersFilter] = useState("");

  const branchCustomerId = selectedCustomerId || currentUser?.assignedCustomer;

  // Get the customer assigned to current user / selected branch
  const assignedCustomer = customers.find(
    (c) => String(c._id || c.id) === String(branchCustomerId)
  );

  // Filter users by assigned customer (users that belong to the same customer)
  const customerUsers = assignedCustomer
    ? users.filter((u) => String(u.assignedCustomer) === String(assignedCustomer._id || assignedCustomer.id))
    : [];

  // Apply additional keyword filter
  const filteredUsers = usersFilter
    ? customerUsers.filter(
        (u) =>
          u.username?.toLowerCase().includes(usersFilter.toLowerCase()) ||
          u.key?.toLowerCase().includes(usersFilter.toLowerCase()) ||
          u.fullNamePrivate?.toLowerCase().includes(usersFilter.toLowerCase())
      )
    : customerUsers;

  const columns = [
    { title: "User", dataIndex: "username", key: "username" },
    { title: "Họ tên", dataIndex: "fullNamePrivate", key: "fullNamePrivate" },
    { title: "Chức vụ", dataIndex: "chucVu", key: "chucVu" },
    {
      title: "Hoạt động",
      key: "status",
      render: (_v, record) => {
        const userId = String(record.id || record._id || "").trim();
        const userKey = String(record.key || "").trim();
        const isOnline = !!(userStatus && (userStatus[userId] === "online" || userStatus[userKey] === "online"));
        return (
          <Badge
            status={isOnline ? "success" : "default"}
            text={isOnline ? "Online" : "Offline"}
          />
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_v, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              editForm.setFieldsValue({
                fullNamePrivate: record.fullNamePrivate || "",
                password: "",
                chucVu: record.chucVu || "",
              });
            }}
          >
            Sửa
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete?.(record.id || record._id, record.username)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
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
            <Button onClick={() => onReload?.()} icon={<ReloadOutlined />} />
          </Popover>
          {assignedCustomer && (
            <Button 
              type="primary" 
              onClick={() => setAddAccountVisible?.(true)} 
              icon={<PlusOutlined />}
            >
              Thêm tài khoản
            </Button>
          )}
        </Space>
      </div>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Tài khoản chi nhánh {assignedCustomer?.companyName || ""}
      </Typography.Title>

      {!assignedCustomer ? (
        <Empty
          description="Bạn chưa được gán chi nhánh"
          style={{ marginTop: 50 }}
        />
      ) : (
        <Table
          className="responsive-table"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={(filteredUsers || []).map((u, idx) => ({
            ...u,
            key: `${u.id || u._id || "user-" + idx}-${idx}`,
          }))}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          scroll={{ x: true }}
          style={{ width: "100%", whiteSpace: "nowrap" }}
          locale={{
            emptyText: <Empty description="Không có tài khoản nào" />,
          }}
          bordered
        />
      )}

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

            let updateData = { ...vals };
            delete updateData.permission;
            onEdit?.(String(editId), updateData);
            setEditing(null);
          }}
        >
          <Form.Item label="Họ tên" name="fullNamePrivate">
            <Input />
          </Form.Item>
          <Form.Item label="Mật khẩu mới" name="password">
            <Input.Password />
          </Form.Item>
          <Form.Item label="Chức vụ" name="chucVu">
            <Input placeholder="Nhập chức vụ" />
          </Form.Item>
        </Form>
      </Drawer>
      </Card>

      <CustomerAccountCreation
        visible={addAccountVisible}
        onClose={() => setAddAccountVisible?.(false)}
        onSubmit={onAddAccount}
        currentUser={currentUser}
        customers={customers}
        loading={addAccountLoading}
      />
    </>
  );
}