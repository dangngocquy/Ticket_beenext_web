import React, { useState, useEffect } from "react";
import { App as AntApp, Button, Card, Form, Input, Typography, Divider, Row, Col, Flex, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { WindowsOutlined, AndroidOutlined } from "@ant-design/icons";
import { Api } from "../service/Api";
import logo from "../asset/logo.png";

const PRIMARY_COLOR = "#ed3237";
const GITHUB_OWNER = "dangngocquy";
const GITHUB_REPO = "Service_Ticket";

export default function Login({ setAuthUser }) {
  const { message } = AntApp.useApp();
  const navigate = useNavigate();
  const [loginForm] = Form.useForm();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [latestRelease, setLatestRelease] = useState(null);
  const [downloading, setDownloading] = useState({ windows: false, android: false });
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch latest release from GitHub
  useEffect(() => {
    fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`)
      .then(res => res.json())
      .then(data => {
        if (data && !data.message) {
          setLatestRelease(data);
        }
      })
      .catch(err => console.log('Failed to fetch latest release:', err));
  }, []);

  const downloadFile = (url, filename) => {
    try {
      // Tạo một link ẩn và click để download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'download';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      // Thêm vào DOM và click
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  };

  const handleDownload = (platform) => {
    if (!latestRelease) {
      message.error("Không thể tải thông tin phiên bản mới nhất");
      return;
    }

    setDownloading(prev => ({ ...prev, [platform]: true }));

    try {
      let asset = null;

      if (platform === 'windows') {
        asset = latestRelease.assets.find(a => 
          a.name.toLowerCase().includes('.exe') || 
          a.name.toLowerCase().includes('windows') ||
          a.name.toLowerCase().includes('win')
        );
      } else if (platform === 'android') {
        asset = latestRelease.assets.find(a => 
          a.name.toLowerCase().includes('.apk') || 
          a.name.toLowerCase().includes('android') ||
          a.name.toLowerCase().includes('mobile')
        );
      }

      if (!asset) {
        console.error(`Không tìm thấy file ${platform} trong phiên bản ${latestRelease.tag_name}`);
        return;
      }

      const success = downloadFile(asset.browser_download_url, asset.name);
      if (success) {
        console.success(`Đã bắt đầu tải ${asset.name}`);
      } else {
        console.error("Tải xuống thất bại");
      }
    } catch (error) {
      console.error("Có lỗi xảy ra khi tải xuống");
      console.error(error);
    } finally {
      setDownloading(prev => ({ ...prev, [platform]: false }));
    }
  };

  const onLogin = async (vals) => {
    try {
      setLoggingIn(true);
      const u = await Api.login(vals);
      setAuthUser({ ...(u || {}), sessionStartedAt: Date.now() });
      message.success("Đăng nhập thành công");
      navigate("/app/form", { replace: true });
    } catch (e) {
      message.error(e?.message || "Đăng nhập thất bại");
    } finally {
      setLoggingIn(false);
    }
  };

  const DownloadSection = () => (
    <div style={{ marginBottom: 24 }}>
      <Typography.Paragraph style={{ fontSize: 13, color: "#666", marginBottom: 8, textAlign: "center" }}>
        Tải ứng dụng
      </Typography.Paragraph>
      <Typography.Paragraph style={{ fontSize: 11, color: "#999", marginBottom: 12, textAlign: "center" }}>
        {latestRelease ? (
          <span style={{ color: PRIMARY_COLOR }}>
            Version: {latestRelease.tag_name}
          </span>
        ) : (
          "Đang tải thông tin phiên bản..."
        )}
      </Typography.Paragraph>
      <Row gutter={12} style={{ width: "100%" }}>
        <Col xs={12} sm={12}>
          <Button 
            type="default" 
            block 
            icon={downloading.windows ? <Spin size="small" /> : <WindowsOutlined style={{ fontSize: 16 }} />}
            onClick={() => handleDownload('windows')}
            disabled={downloading.windows}
          >
            {downloading.windows ? 'Đang tải...' : 'Windows'}
          </Button>
        </Col>
        <Col xs={12} sm={12}>
          <Button 
            type="default" 
            block 
            icon={downloading.android ? <Spin size="small" /> : <AndroidOutlined style={{ fontSize: 16 }} />}
            onClick={() => handleDownload('android')}
            disabled={downloading.android}
          >
            {downloading.android ? 'Đang tải...' : 'Android'}
          </Button>
        </Col>
      </Row>
    </div>
  );

  return (
    <div 
      style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        padding: isMobile ? 12 : 24,
        background: `linear-gradient(135deg, rgba(237, 50, 55, 0.082) 0%, rgba(237, 50, 55, 0.03) 100%)`,
      }}
    >
      <Card 
        style={{ 
          width: isMobile ? "100%" : 420,
          maxWidth: "100%",
          boxShadow: "0 4px 24px rgba(237, 50, 55, 0.1)",
          border: `1px solid ${PRIMARY_COLOR}20`,
        }}
        bodyStyle={{ padding: isMobile ? 20 : 32 }}
      >
        {/* Logo Section */}
        <Flex justify="center" style={{ marginBottom: 24 }}>
          <img 
            src={logo} 
            alt="BeeNext" 
            style={{ 
              height: 60, 
              objectFit: "contain",
              filter: `brightness(0.95) saturate(1.1)`
            }} 
          />
        </Flex>

        {/* Login Form */}
        <Form 
          form={loginForm} 
          layout="vertical" 
          onFinish={onLogin}
          style={{ marginTop: 20 }}
        >
          <Form.Item 
            name="username" 
            label={<span style={{ color: "#333", fontSize: 13, fontWeight: 500 }}>Tài khoản</span>}
            rules={[{ required: true, message: "Vui lòng nhập tài khoản" }]}
          >
            <Input 
              autoFocus 
              placeholder="Nhập tài khoản" 
              size="middle"
              style={{ borderRadius: 6 }}
            />
          </Form.Item>
          <Form.Item 
            name="password" 
            label={<span style={{ color: "#333", fontSize: 13, fontWeight: 500 }}>Mật khẩu</span>}
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}
          >
            <Input.Password 
              placeholder="Nhập mật khẩu" 
              size="middle"
              style={{ borderRadius: 6 }}
            />
          </Form.Item>

          <Button 
            type="primary" 
            htmlType="submit"
            block
            size="middle"
            loading={loggingIn}
            disabled={loggingIn}
          >
            {loggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </Form>

        {/* Download Section */}
        <Divider style={{ margin: "16px 0", borderColor: `${PRIMARY_COLOR}30` }} />
        <DownloadSection />

        {/* Footer */}
        <Typography.Paragraph 
          style={{ 
            textAlign: "center", 
            color: "#ccc",
            marginTop: 20,
            fontSize: 12,
            marginBottom: 0
          }}
        >
          © {new Date().getFullYear()} by Đặng Ngọc Quý. All rights reserved.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}