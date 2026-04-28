import React from "react";
import { Button, Form, Input, Drawer, Select, Space, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";

// CustomerAccountCreation: Drawer for creating new customer user account
export default function CustomerAccountCreation({
  visible,
  onClose,
  onSubmit,
  currentUser = {},
  customers = [],
  loading = false,
  customerId,
}) {
  const [form] = Form.useForm();

  // Get the customer - either from customerId prop or from currentUser
  const assignedCustomer = customerId 
    ? customers.find((c) => String(c._id || c.id) === String(customerId))
    : customers.find((c) => String(c._id || c.id) === String(currentUser?.assignedCustomer));

  const handleSubmit = async (vals) => {
    if (!assignedCustomer) {
      message.error("Không tìm thấy thông tin chi nhánh");
      return;
    }

    try {
      await onSubmit?.({
        ...vals,
        customerId: assignedCustomer._id || assignedCustomer.id,
      });
      form.resetFields();
    } catch (e) {
      console.error("Error creating account:", e);
    }
  };

  return (
    <Drawer
      open={visible}
      title="Thêm tài khoản mới"
      onClose={() => {
        onClose?.();
        form.resetFields();
      }}
      destroyOnClose
      width={500}
      footer={
        <Space style={{ float: "right" }}>
          <Button onClick={() => onClose?.()}>Hủy</Button>
          <Button type="primary" loading={loading} onClick={() => form.submit()}>
            Thêm tài khoản
          </Button>
        </Space>
      }
    >
      {!assignedCustomer ? (
        <div style={{ color: "#999", marginTop: 20 }}>
          Bạn chưa được gán chi nhánh
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item 
            label="Chi nhánh" 
            name="companyName"
          >
            <Input disabled value={assignedCustomer.companyName} />
          </Form.Item>
          
          <Form.Item
            label="Username"
            name="username"
            rules={[
              { required: true, message: "Vui lòng nhập username" },
              { min: 3, message: "Username phải ít nhất 3 ký tự" },
            ]}
          >
            <Input placeholder="Nhập username" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu" },
              { min: 6, message: "Mật khẩu phải ít nhất 6 ký tự" },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item
            label="Họ tên"
            name="fullNamePrivate"
            rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          <Form.Item label="Chức vụ" name="chucVu">
            <Input placeholder="Nhập chức vụ (tùy chọn)" />
          </Form.Item>
        </Form>
      )}
    </Drawer>
  );
}
