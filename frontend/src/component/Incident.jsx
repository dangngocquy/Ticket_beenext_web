import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { AutoComplete, Button, Card, DatePicker, Form, Input, message, Modal, Popover, Segmented, Select } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import CkEditor from "./CkEditor";

export default function IncidentTab({
  form,
  onSaveTicket,
  customers,
  users,
  user,
  performerDisplayName,
  formResetKey,
  setFormResetKey,
  tinhTrangSuggestions,
  tinhTrangFilteredOptions,
  setTinhTrangFilteredOptions,
  tinhTrangSearchValue,
  setTinhTrangSearchValue,
  onPrintCurrentForm,
  openFormPrintPreview,
  printingTicket,
  savingTicket,
  cfg,
  translations,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [contactSuggestions, setContactSuggestions] = useState([]);
  const [contactInputOpen, setContactInputOpen] = useState(false);
  const [ticketType, setTicketType] = useState("incident");
  const [assignStatusModalVisible, setAssignStatusModalVisible] = useState(false);
  const [assignStatusPerformer, setAssignStatusPerformer] = useState("");
  const [mobileStatusValue, setMobileStatusValue] = useState("new");
  const [previousStatus, setPreviousStatus] = useState("new");

  useEffect(() => {
    const initialStatus = form.getFieldValue("status") || "new";
    setMobileStatusValue(initialStatus);
    setPreviousStatus(initialStatus);
  }, [form]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return (
    <Card className="panel">
      <Form
        layout="vertical"
        form={form}
        initialValues={{
          ngay: dayjs(),
          phiDichVu: "0",
          ketQua: "Đã hoàn thành",
          rating: "",
          loaiPhieu: "incident",
          status: "new",
        }}
        onFinish={onSaveTicket}
      >
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(320px, 1fr)", gap: 12, marginBottom: isMobile ? 12 : 24 }}>
          <Form.Item
            name="loaiPhieu"
            label={
              <span>
                Loại
                <Popover
                  content={
                    <div style={{ maxWidth: 240 }}>
                      <p style={{ margin: 0 }}><b>Incident</b>: Vấn đề cần xử lý ngay hoặc sự cố.</p>
                      <p style={{ margin: 0 }}><b>Request</b>: Yêu cầu dịch vụ, hỗ trợ hoặc thay đổi.</p>
                    </div>
                  }
                  placement="right"
                >
                  <InfoCircleOutlined style={{ color: '#ed3237', marginLeft: 4 }} />
                </Popover>
              </span>
            }
            rules={[{ required: true, message: "Chọn loại" }]}
            style={{ marginBottom: 0, width: "100%" }}
          >
            <Segmented
              value={ticketType}
              size="middle"
              onChange={(val) => {
                setTicketType(val);
                form.setFieldsValue({ loaiPhieu: val });
              }}
              options={[
                { label: "Incident", value: "incident" },
                { label: "Request", value: "request" },
              ]}
            />
          </Form.Item>

          {isMobile ? (
            <Form.Item label="Trạng thái phiếu" name="status" style={{ marginBottom: 0 }}>
              <Select
                value={mobileStatusValue}
                options={[
                  { label: "New", value: "new" },
                  { label: "Assigned", value: "assigned" },
                  { label: "In Progress", value: "in_progress" },
                  { label: "Pending", value: "pending" },
                  { label: "Resolved", value: "resolved" },
                  { label: "Closed", value: "closed" },
                ]}
                disabled={!user || savingTicket}
                onChange={(val) => {
                  if (val === "assigned") {
                    const currentStatus = mobileStatusValue || "new";
                    setPreviousStatus(currentStatus);
                    setAssignStatusPerformer(form.getFieldValue("nguoiThucHien") || performerDisplayName || "");
                    setAssignStatusModalVisible(true);
                    return;
                  }
                  setMobileStatusValue(val);
                  form.setFieldsValue({ status: val });
                }}
              />
            </Form.Item>
          ) : null}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <Form.Item label="Ngày" name="ngay" rules={[{ required: true, message: "Chọn ngày" }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Khách hàng" name="khachHang" rules={[{ required: true, message: "Chọn khách hàng" }]}>
            <Select
              showSearch
              placeholder="Chọn khách hàng"
              allowClear
              options={Array.from(new Set((customers || []).map((c) => c.companyName))).map((c) => ({
                label: c,
                value: c,
              }))}
              onChange={(val) => {
                const selectedCompanyName = val;
                if (!selectedCompanyName) {
                  setContactSuggestions([]);
                  return;
                }
                const selectedCustomer = (customers || []).find((c) => c.companyName === selectedCompanyName);
                if (!selectedCustomer) return;
                
                // Prepare contact suggestions
                const contacts = selectedCustomer.contacts || [];
                if (selectedCustomer.name && !contacts.length) {
                  // Fallback for old data format
                  setContactSuggestions([
                    { label: selectedCustomer.name, value: selectedCustomer.name, phone: selectedCustomer.phone }
                  ]);
                } else if (contacts.length > 0) {
                  // New format
                  setContactSuggestions(
                    contacts.map((c) => ({
                      label: `${c.name}${c.phone ? ` (${c.phone})` : ''}`,
                      value: c.name,
                      phone: c.phone
                    }))
                  );
                }
                
                // Set address and first contact
                form.setFieldsValue({
                  diaChi: selectedCustomer.address || "",
                  nguoiThucHien: performerDisplayName,
                });
                
                if (contacts.length > 0) {
                  form.setFieldsValue({
                    nguoiLienHe: contacts[0].name || "",
                    phone: contacts[0].phone || "",
                  });
                } else if (selectedCustomer.name) {
                  form.setFieldsValue({
                    nguoiLienHe: selectedCustomer.name || "",
                    phone: selectedCustomer.phone || "",
                  });
                }
              }}
            />
          </Form.Item>
        </div>
        <Form.Item label="Người thực hiện" name="nguoiThucHien" rules={[{ required: true }]} style={{ display: "none" }}>
          <Select
            showSearch
            allowClear={false}
            disabled
            optionLabelProp="title"
            options={(users || [])
              .map((u) => {
                const name = u.username || u.key;
                const chucVu = u.chucVu || "";
                return {
                  title: name,
                  label: (
                    <div>
                      <div>{name}</div>
                      {chucVu && <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div>}
                    </div>
                  ),
                  value: u.key || u.username,
                };
              })
              .filter((o) => o.value)}
          />
        </Form.Item>
        {!isMobile ? (
          <Form.Item name="status" style={{ display: "none" }}>
            <Input />
          </Form.Item>
        ) : null}
        <Form.Item name="soPhieu" style={{ display: "none" }}>
          <Input />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
          <Form.Item label="Người liên hệ" name="nguoiLienHe" style={{ marginBottom: 0 }}>
            <AutoComplete
              open={contactInputOpen}
              onDropdownVisibleChange={setContactInputOpen}
              options={contactSuggestions}
              placeholder="Nhập người liên hệ"
              filterOption={(inputValue, option) =>
                !inputValue || (option?.label || '').toLowerCase().includes(inputValue.toLowerCase())
              }
              onSelect={(value) => {
                // When user selects a contact, also set phone
                const selected = contactSuggestions.find((c) => c.value === value);
                if (selected?.phone) {
                  form.setFieldsValue({ phone: selected.phone });
                }
                setContactInputOpen(false);
              }}
            />
          </Form.Item>
          <Form.Item label="SĐT / Email" name="phone" style={{ marginBottom: 0 }}>
            <Input placeholder="Nhập SĐT hoặc Email"/>
          </Form.Item>
          <Form.Item label="Phí dịch vụ" name="phiDichVu" style={{ marginBottom: 0 }}>
            <Input />
          </Form.Item>
        </div>
        <Form.Item label="Địa chỉ" name="diaChi" rules={[{ required: true, message: "Vui lòng nhập địa chỉ" }]}>
          <Input.TextArea rows={2} placeholder="Nhập địa chỉ"/>
        </Form.Item>

        <Form.Item label="1. Tình trạng" name="tinhTrang">
          <AutoComplete
            options={tinhTrangFilteredOptions}
            open={tinhTrangFilteredOptions.length > 0}
            onSearch={(text) => {
              setTinhTrangSearchValue(text);
              if (!text || text.trim() === "") {
                // Không hiện gợi ý khi không nhập gì
                setTinhTrangFilteredOptions([]);
                return;
              }
              const filtered = (tinhTrangSuggestions || [])
                .filter((s) => s.toLowerCase().includes(text.toLowerCase()))
                .slice(0, 6)
                .map((s) => ({ value: s }));
              setTinhTrangFilteredOptions(filtered);
            }}
            onSelect={(value) => {
              form.setFieldsValue({ tinhTrang: value });
              setTinhTrangSearchValue("");
              setTinhTrangFilteredOptions([]);
            }}
            onFocus={() => {
              // Không hiện gợi ý khi focus nếu field rỗng
              const current = form.getFieldValue("tinhTrang") || "";
              if (current.trim() === "") {
                setTinhTrangFilteredOptions([]);
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setTinhTrangFilteredOptions([]);
              }, 200);
            }}
            placeholder="Nhập tình trạng..."
          >
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 3 }}
              value={form.getFieldValue("tinhTrang") || ""}
              onChange={(e) => {
                const value = e.target.value;
                form.setFieldsValue({ tinhTrang: value });
                if (value && value.trim() !== "") {
                  const filtered = (tinhTrangSuggestions || [])
                    .filter((s) => s.toLowerCase().includes(value.toLowerCase()))
                    .slice(0, 6)
                    .map((s) => ({ value: s }));
                  setTinhTrangFilteredOptions(filtered);
                  setTinhTrangSearchValue(value);
                } else {
                  // Không hiện gợi ý khi xóa hết
                  setTinhTrangFilteredOptions([]);
                  setTinhTrangSearchValue("");
                }
              }}
            />
          </AutoComplete>
        </Form.Item>
        <Form.Item
          label="2. Phương án xử lý"
          name="phuongAnXuLy"
        >
          <CkEditor name="phuongAnXuLy" form={form} resetKey={formResetKey} placeholder="Nhập phương án xử lý..." />
        </Form.Item>
        <Form.Item label="3. Kết quả" name="ketQua">
          <CkEditor name="ketQua" form={form} resetKey={formResetKey} placeholder="Nhập kết quả..." />
        </Form.Item>

        <Form.Item label="Đánh giá (0-5)" name="rating">
          <Input
            type="number"
            min={0}
            max={5}
            placeholder="Nhập đánh giá (0-5)"
          />
          <div style={{ marginTop: 4, fontSize: 12, color: "#666", fontStyle: "italic" }}>
            Hướng dẫn: Nhấn Ctrl+S để lưu, Ctrl+P để in
          </div>
        </Form.Item>

        <Form.Item className="incident-form-actions">
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button
              type="primary"
              onClick={() => form.submit()}
              loading={savingTicket}
              disabled={!user}
              size="middle"
            >
              Lưu (Ctrl+S)
            </Button>
            <Button
              onClick={openFormPrintPreview}
              disabled={!user || savingTicket}
              size="middle"
            >
              In (Ctrl+P)
            </Button>
          </div>
        </Form.Item>

        {!user && (
          <Form.Item>
            <div style={{ color: "#d4380d", textAlign: "center" }}>Đăng nhập để thao tác</div>
          </Form.Item>
        )}

      </Form>

      <Modal
        title="Chọn người thực hiện"
        open={assignStatusModalVisible}
        onCancel={() => {
          setAssignStatusModalVisible(false);
          setAssignStatusPerformer("");
          setMobileStatusValue(previousStatus);
          form.setFieldsValue({ status: previousStatus });
        }}
        onOk={() => {
          if (!assignStatusPerformer) {
            message.error("Vui lòng chọn người thực hiện");
            return;
          }
          setMobileStatusValue("assigned");
          form.setFieldsValue({ status: "assigned", nguoiThucHien: assignStatusPerformer });
          setAssignStatusModalVisible(false);
          setAssignStatusPerformer("");
        }}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <Form layout="vertical">
          <Form.Item label="Người thực hiện" required>
            <Select
              showSearch
              optionLabelProp="title"
              optionFilterProp="title"
              placeholder="Chọn người thực hiện"
              style={{ width: '100%' }}
              value={assignStatusPerformer || undefined}
              onChange={(v) => setAssignStatusPerformer(v)}
              options={(users || [])
                .map((u) => {
                  const name = u.fullNamePrivate || u.username || u.key;
                  const chucVu = u.chucVu || "";
                  const value = u.key || u.username || name;
                  return {
                    title: name,
                    label: (
                      <div>
                        <div>{name}</div>
                        {chucVu ? <div style={{ fontSize: 12, color: "#999" }}>{chucVu}</div> : null}
                      </div>
                    ),
                    value,
                  };
                })
                .filter((o) => o.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

