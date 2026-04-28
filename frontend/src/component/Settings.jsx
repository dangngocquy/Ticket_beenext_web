import React, { useState, useRef, useCallback, useEffect } from "react";
import { Card, Typography, Button, Space, message, Divider, Spin, Modal } from "antd";
import { GlobalOutlined, CloudUploadOutlined } from "@ant-design/icons";
import { FaEraser, FaTrashAlt } from "react-icons/fa";
import SignaturePad from "signature_pad";
import { Api } from "../service/Api";

export default function SettingsTab({ selectedLanguage = "vi", onChangeLanguage, currentUser }) {
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [currentSignature, setCurrentSignature] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // "saving", "saved", null
  const [isEraserMode, setIsEraserMode] = useState(false);
  const signaturePadRef = useRef(null);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);

  const loadCurrentSignature = useCallback(async () => {
    try {
      const userId = String(currentUser?.id || currentUser?._id || "").trim();
      const sig = await Api.getCurrentUserSignature(userId);
      if (sig?.signatureDataUrl) {
        setCurrentSignature(sig.signatureDataUrl);
        if (signaturePadRef.current) {
          signaturePadRef.current.fromDataURL(sig.signatureDataUrl);
        }
      }
    } catch (e) {
      // No signature yet, that's ok
    }
  }, [currentUser?.id, currentUser?._id]);

  const handleSignatureChange = useCallback(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set saving status
    setAutoSaveStatus("saving");
    
    // Auto-save after 300ms of no drawing
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        setAutoSaveStatus(null);
        return;
      }

      try {
        const signatureDataUrl = signaturePadRef.current.toDataURL("image/png");
        await Api.uploadSignature(currentUser?.id || currentUser?._id, signatureDataUrl);
        setCurrentSignature(signatureDataUrl);
        setAutoSaveStatus("saved");
        
        // Clear status after 2 seconds
        setTimeout(() => {
          setAutoSaveStatus(null);
        }, 2000);
      } catch (e) {
        setAutoSaveStatus(null);
        console.error("Auto-save failed:", e?.message || "Unknown error");
      }
    }, 300);
  }, [currentUser?.id, currentUser?._id]);

  const resizeCanvas = useCallback(() => {
    if (!canvasRef.current || !canvasContainerRef.current) return;
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const width = Math.min(container.clientWidth, 560);
    const height = Math.round((width / 320) * 200);
    const ratio = window.devicePixelRatio || 1;
    const dataUrl = signaturePadRef.current ? signaturePadRef.current.toDataURL("image/png") : null;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      if (dataUrl) {
        signaturePadRef.current.fromDataURL(dataUrl);
      }
    }
  }, []);

  React.useEffect(() => {
    // Initialize signature pad on mount
    if (canvasRef.current && !signaturePadRef.current) {
      const canvas = canvasRef.current;
      resizeCanvas();
      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
        velocityFilterWeight: 0.7,
        minWidth: 0.5,
        maxWidth: 2.5,
      });
      // Load current signature
      loadCurrentSignature();
    }

    // Handle window resize
    window.addEventListener("resize", resizeCanvas);
    const canvas = canvasRef.current;
    const handleEndStroke = () => handleSignatureChange();
    if (canvas) {
      canvas.addEventListener("endStroke", handleEndStroke);
    }
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (canvas) {
        canvas.removeEventListener("endStroke", handleEndStroke);
      }
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [handleSignatureChange, loadCurrentSignature, resizeCanvas]);

  React.useEffect(() => {
    loadCurrentSignature();
  }, [loadCurrentSignature]);

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleUploadSignature = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      message.error("Vui lòng vẽ chữ ký trước khi lưu");
      return;
    }

    setIsUploadingSignature(true);
    try {
      const signatureDataUrl = signaturePadRef.current.toDataURL("image/png");
      await Api.uploadSignature(currentUser?.id || currentUser?._id, signatureDataUrl);
      setCurrentSignature(signatureDataUrl);
      message.success("Chữ ký đã được lưu thành công");
    } catch (e) {
      message.error(e?.message || "Lỗi lưu chữ ký");
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const handleDeleteSignature = async () => {
    Modal.confirm({
      title: "Xóa chữ ký",
      content: "Bạn có chắc muốn xóa chữ ký hiện tại?",
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          await Api.uploadSignature(currentUser?.id || currentUser?._id, null);
          setCurrentSignature(null);
          if (signaturePadRef.current) signaturePadRef.current.clear();
          message.success("Chữ ký đã được xóa");
        } catch (e) {
          message.error(e?.message || "Lỗi xóa chữ ký");
        }
      },
    });
  };

  return (
    <Card className="panel">
      <Typography.Title level={5} style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <GlobalOutlined />
        Cài đặt ngôn ngữ
      </Typography.Title>

      <Typography.Paragraph style={{ color: "#666", marginBottom: 16 }}>
        Chọn ngôn ngữ để hiển thị phiếu in. Lựa chọn sẽ được lưu cho các lần sử dụng sau.
      </Typography.Paragraph>

      <div className="settings-language-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 12 }}>
        {[
          { key: "vi", label: "Tiếng Việt" },
          { key: "en", label: "English" },
        ].map((lang) => {
          const active = selectedLanguage === lang.key;
          return (
            <div
              key={lang.key}
              onClick={() => onChangeLanguage?.(lang.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onChangeLanguage?.(lang.key);
              }}
              style={{
                padding: "14px 16px",
                borderRadius: 8,
                border: active ? "2px solid #ed3237" : "1px solid #d9d9d9",
                background: active ? "rgba(237,50,55,0.08)" : "#fff",
                color: active ? "#ed3237" : "inherit",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                userSelect: "none",
                transition: "all .2s ease",
                textAlign: "center",
              }}
            >
              {lang.label} {active ? "✓" : ""}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#e6f7ff", border: "1px solid #91d5ff" }}>
        <Typography.Text style={{ fontSize: 12, color: "#0c5aa0" }}>
          <strong>Lưu ý:</strong> Khi chọn ngôn ngữ, xem trước / in / xuất PDF sẽ ưu tiên ngôn ngữ này nếu có dữ liệu dịch.
        </Typography.Text>
      </div>

      <Divider style={{ margin: "24px 0" }} />

      <Typography.Title level={5} style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <CloudUploadOutlined />
        Quản lý chữ ký
      </Typography.Title>

      <Typography.Paragraph style={{ color: "#666", marginBottom: 16 }}>
        Chữ ký của bạn sẽ tự động được thêm vào mục "Kỹ thuật viên".
      </Typography.Paragraph>

      <Spin spinning={isUploadingSignature} style={{ display: "flex",}}>
        <div
        ref={canvasContainerRef}
        style={{
          width: "100%",
          background: "#f5f5f5",
          padding: 16,
          borderRadius: 8,
          border: "1px solid #d9d9d9",
          marginBottom: 16,
          boxSizing: "border-box",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            border: "1px solid #ccc",
            borderRadius: 4,
            cursor: "crosshair",
            touchAction: "none",
            backgroundColor: "#fff",
            margin: "0 auto",
          }}
        />
        <div style={{ fontSize: 12, color: "#999", marginTop: 8, textAlign: "center" }}>
          Vẽ chữ ký của bạn ở đây
        </div>
      </div>
      </Spin>

      <Space style={{ justifyContent: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <Button onClick={handleClearSignature} disabled={isUploadingSignature}>
          Vẽ lại
        </Button>
        <Button
          type={isEraserMode ? "default" : "primary"}
          onClick={() => {
            if (!signaturePadRef.current) return;
            const nextMode = !isEraserMode;
            setIsEraserMode(nextMode);
            signaturePadRef.current.penColor = nextMode ? "#ffffff" : "#000000";
            signaturePadRef.current.minWidth = nextMode ? 8 : 0.5;
            signaturePadRef.current.maxWidth = nextMode ? 16 : 2.5;
          }}
          icon={<FaEraser />}
          disabled={isUploadingSignature}
        >
          {isEraserMode ? "Tẩy" : "Vẽ"}
        </Button>
        <Button
          type="primary"
          onClick={handleUploadSignature}
          loading={isUploadingSignature}
        >
          Save
        </Button>
        {currentSignature && (
          <Button danger onClick={handleDeleteSignature} disabled={isUploadingSignature} icon={<FaTrashAlt />}>
            Delete
          </Button>
        )}
        {autoSaveStatus === "saving" && (
          <span style={{ color: "#faad14", fontWeight: 500 }}>⏳ Đang lưu...</span>
        )}
        {autoSaveStatus === "saved" && (
          <span style={{ color: "#52c41a", fontWeight: 500 }}>✓ Đã lưu tự động</span>
        )}
      </Space>

      {currentSignature && (
        <div style={{ padding: 12, borderRadius: 8, background: "#f0f5ff", border: "1px solid #bae7ff" }}>
          <Typography.Text style={{ fontSize: 12, color: "#0c5aa0" }}>
            <strong>✓ Chữ ký đã được lưu -</strong> Chữ ký của bạn sẽ tự động được thêm vào mục "Kỹ thuật viên" khi in phiếu.
          </Typography.Text>
        </div>
      )}
    </Card>
  );
}