import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Form, Input, Button, message, Card } from "antd";
import { LockOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { Api } from "../service/Api";

export default function ChangePasswordPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { authUser } = useOutletContext();

  const handleSubmit = async (values) => {
    if (!authUser) {
      message.warning("Vui lòng đăng nhập để đổi mật khẩu");
      return;
    }

    setLoading(true);
    try {
      if (!Api.changePassword) {
        throw new Error("API không hỗ trợ đổi mật khẩu");
      }

      const userId = authUser._id || authUser.id || authUser.key;
      if (!userId) {
        throw new Error("Không xác định được tài khoản");
      }

      await Api.changePassword(String(userId), {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });

      message.success("Đổi mật khẩu thành công");
      form.resetFields();
      navigate("/app/form", { replace: true });
    } catch (err) {
      message.error(err?.message || "Lỗi khi đổi mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  return (
       <Card style={{width: '100%'}}>
         <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="Mật khẩu hiện tại"
            name="oldPassword"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu hiện tại" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu hiện tại" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { required: true, message: "Vui lòng nhập mật khẩu mới" },
              { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu mới" />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu mới"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Mật khẩu xác nhận không khớp"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading} icon={<CheckCircleOutlined />}>
              Cập nhật mật khẩu
            </Button>
          </Form.Item>
        </Form>
       </Card>
  );
}
