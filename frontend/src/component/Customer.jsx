import React, { useState } from "react";
import { Button, Card, Form, Input, Drawer, Table, Typography, Popover, Space, Empty, Divider, Row, Col, Modal } from "antd";
import { DeleteOutlined, EditOutlined, ReloadOutlined, PlusOutlined, MinusOutlined, UserOutlined } from "@ant-design/icons";
import CustomerAccountManagement from "./customer/CustomerAccountManagement";

// CustomerTab (web): UI-only component. All persistence is handled by callbacks from App.js.
export default function CustomerTab({ data = [], loading, onEdit, onDelete, filter, customersFilter, setCustomersFilter, loadCustomers, setCustomersDrawerVisible, users = [], currentUser = {}, userStatus = {}, onEditUser, onDeleteUser, onReloadUsers, onAddCustomerAccount }) {
    const [editForm] = Form.useForm();
    const [editing, setEditing] = useState(null);
    const [accountManagementVisible, setAccountManagementVisible] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [addAccountVisible, setAddAccountVisible] = useState(false);
    const [addAccountLoading, setAddAccountLoading] = useState(false);

    const filteredData = filter
      ? (data || []).filter(
        (c) =>
          c.companyName?.toLowerCase().includes(filter.toLowerCase()) ||
          c.address?.toLowerCase().includes(filter.toLowerCase()) ||
          String(c.name || "").toLowerCase().includes(filter.toLowerCase()) ||
          String(c.phone || "").toLowerCase().includes(filter.toLowerCase()) ||
          (c.contacts || []).some((ct) => 
            String(ct.name || "").toLowerCase().includes(filter.toLowerCase()) ||
            String(ct.phone || "").toLowerCase().includes(filter.toLowerCase())
          )
      )
      : data || [];

    const columns = [
      { title: "Công ty", dataIndex: "companyName", key: "companyName", width: 200 },
      { 
        title: "Người liên hệ", 
        key: "contacts",
        width: 150,
        render: (_v, record) => {
          const contacts = record.contacts || [];
          const count = contacts.length || (record.name ? 1 : 0);
          if (count === 0) return <span style={{ color: '#999' }}>Không có</span>;
          return (
            <span style={{ fontWeight: 500, color: '#ed3237' }}>
              {count} liên hệ
            </span>
          );
        }
      },
      { title: "Địa chỉ", dataIndex: "address", key: "address", width: 200 },
      {
        title: "Thao tác",
        key: "actions",
        width: 120,
        render: (_v, record) => (
          <>
            <Button
              size="small"
            icon={<EditOutlined />}
            style={{ marginRight: 8 }}
              onClick={() => {
                setEditing(record);
                const contacts = record.contacts || [];
                if (record.name && !contacts.length) {
                  // Migrate old format
                  contacts.push({ name: record.name, phone: record.phone || "" });
                }
                editForm.setFieldsValue({
                  companyName: record.companyName,
                  address: record.address,
                  contacts: contacts,
                });
              }}
            >
              Sửa
            </Button>
            <Button
              size="small"
              icon={<UserOutlined />}
              style={{ marginRight: 8 }}
              onClick={() => {
                setSelectedCustomer(record);
                setAccountManagementVisible(true);
              }}
            >
              Chi tiết
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            onClick={() => onDelete?.(record.id || record._id, record.companyName)}
            >
              Xóa
            </Button>
          </>
        ),
      },
    ];

    return (
    <Card className="panel">
      <div className="panel-toolbar" style={{ marginBottom: 12, marginTop: 16, justifyContent: "flex-start" }}>
        <Input.Search
          className="panel-search"
          placeholder="Tìm công ty / người liên hệ / SĐT / Email / địa chỉ"
          allowClear
          value={customersFilter}
          onChange={(e) => setCustomersFilter(e.target.value)}
          style={{ width: 300, minWidth: "200px", marginRight: "auto" }}
        />
        <Space wrap>
          <Popover content="Làm mới">
            <Button onClick={() => loadCustomers()} icon={<ReloadOutlined />} />
          </Popover>
          <Button type="primary" onClick={() => setCustomersDrawerVisible(true)} icon={<PlusOutlined />}>
            Thêm khách hàng
          </Button>
        </Space>
      </div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Khách hàng
      </Typography.Title>

          <Table
            size="small"
            loading={loading}
            columns={columns}
        dataSource={(filteredData || []).map((c, idx) => ({
          ...c,
          key: `${c._id || c.id || "customer-" + idx}-${idx}`,
        }))}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            scroll={{ x: true }}
          style={{ width: '100%', whiteSpace: 'nowrap' }}
          locale={{
            emptyText: <Empty description="Không có dữ liệu" />,
          }}
          bordered
          />

        <Drawer
          open={!!editing}
          title={`Sửa thông tin khách hàng`}
          onClose={() => setEditing(null)}
          destroyOnClose
          width={600}
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
            onEdit?.(String(editId), vals);
              setEditing(null);
            }}
          >
          <Form.Item
            name="companyName"
            label="Công ty"
            rules={[{ required: true, message: "Vui lòng nhập công ty" }]}
          >
              <Input placeholder="Nhập công ty" />
            </Form.Item>
            <Form.Item name="address" label="Địa chỉ">
              <Input.TextArea rows={2} placeholder="Nhập địa chỉ" />
            </Form.Item>

            <Divider>Người liên hệ</Divider>
            <Form.List name="contacts">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => (
                    <Row key={field.key} gutter={8} style={{ marginBottom: 12 }}>
                      <Col flex="1 1 auto" style={{ minWidth: 0 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, "name"]}
                          rules={[{ required: true, message: "Nhập tên" }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input size="small" placeholder="Tên người liên hệ" />
                        </Form.Item>
                      </Col>
                      <Col flex="1 1 auto" style={{ minWidth: 0 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, "phone"]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input size="small" placeholder="SĐT / Email" />
                        </Form.Item>
                      </Col>
                      <Col>
                        <Button
                          type="text"
                          danger
                          icon={<MinusOutlined />}
                          onClick={() => remove(field.name)}
                          size="small"
                        />
                      </Col>
                    </Row>
                  ))}
                  <Form.Item>
                    <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                      Thêm người liên hệ
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form>
        </Drawer>

        <Modal
          open={accountManagementVisible}
          title={`Quản lý tài khoản - ${selectedCustomer?.companyName || ""}`}
          onCancel={() => setAccountManagementVisible(false)}
          footer={null}
          width={1200}
          destroyOnClose
        >
          <CustomerAccountManagement
            users={users}
            loading={false}
            currentUser={currentUser}
            selectedCustomerId={selectedCustomer?._id || selectedCustomer?.id}
            customers={data}
            userStatus={userStatus}
            onEdit={onEditUser}
            onDelete={onDeleteUser}
            onReload={onReloadUsers}
            onAddAccount={async (vals) => {
              setAddAccountLoading(true);
              try {
                await onAddCustomerAccount({
                  ...vals,
                  customerId: selectedCustomer?._id || selectedCustomer?.id,
                });
              } finally {
                setAddAccountLoading(false);
                setAddAccountVisible(false);
              }
            }}
            addAccountVisible={addAccountVisible}
            setAddAccountVisible={setAddAccountVisible}
            addAccountLoading={addAccountLoading}
          />
        </Modal>
    </Card>
    );
}

