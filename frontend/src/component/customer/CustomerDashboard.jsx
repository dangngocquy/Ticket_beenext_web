import React, { useState } from "react";
import { Button, Card, Input, Table, Typography, Popover, Space, Empty, Tag } from "antd";
import { PrinterOutlined, ReloadOutlined, CloudDownloadOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

// CustomerDashboard: Shows all tickets for the customer's assigned branch
export default function CustomerDashboard({
  history = [],
  historyLoading = false,
  currentUser = {},
  customers = [],
  onPrintRecord,
  onDownloadRecord,
  onOpenViewRecord,
  loadHistory,
}) {
  const [filter, setFilter] = useState("");

  // Get the customer assigned to current user
  const assignedCustomer = customers.find(
    (c) => String(c._id || c.id) === String(currentUser?.assignedCustomer)
  );

  // Filter tickets by assigned customer
  const filteredHistory = assignedCustomer
    ? (history || []).filter(
        (h) => h.companyName === assignedCustomer.companyName
      )
    : [];

  // Apply additional keyword filter
  const searchFilteredHistory = filter
    ? filteredHistory.filter(
        (h) =>
          String(h.soPhieu || "").toLowerCase().includes(filter.toLowerCase()) ||
          String(h.companyName || "").toLowerCase().includes(filter.toLowerCase()) ||
          String(h.address || "").toLowerCase().includes(filter.toLowerCase()) ||
          String(h.tinhTrang || "").toLowerCase().includes(filter.toLowerCase()) ||
          String(h.status || "").toLowerCase().includes(filter.toLowerCase())
      )
    : filteredHistory;

  const columns = [
    {
      title: "Số phiếu",
      dataIndex: "soPhieu",
      key: "soPhieu",
      width: 120,
      render: (text) => <strong>{text}</strong>,
    },
    {
      title: "Công ty",
      dataIndex: "companyName",
      key: "companyName",
      width: 150,
    },
    {
      title: "Ngày",
      dataIndex: "date",
      key: "date",
      width: 100,
      render: (text) =>
        text ? dayjs(text).format("DD/MM/YYYY") : "",
    },
    {
      title: "Tình trạng",
      dataIndex: "tinhTrang",
      key: "tinhTrang",
      width: 150,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status) => {
        const statusMap = {
          "đang xử lý": { color: "processing", text: "Đang xử lý" },
          "hoàn thành": { color: "success", text: "Hoàn thành" },
          "chưa xử lý": { color: "default", text: "Chưa xử lý" },
        };
        const s = statusMap[String(status || "").toLowerCase()] || { color: "default", text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      fixed: "right",
      render: (_v, record) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onOpenViewRecord?.(record)}
            title="Xem"
          />
          <Button
            type="text"
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => onPrintRecord?.(record)}
            title="In"
          />
          <Button
            type="text"
            size="small"
            icon={<CloudDownloadOutlined />}
            onClick={() => onDownloadRecord?.(record)}
            title="Tải xuống"
          />
        </Space>
      ),
    },
  ];

  return (
    <Card className="panel">
      <div className="panel-toolbar" style={{ marginBottom: 12, marginTop: 16, justifyContent: "flex-start" }}>
        <Input.Search
          className="panel-search"
          placeholder="Tìm số phiếu / công ty / địa chỉ / tình trạng"
          allowClear
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 350, minWidth: "200px", marginRight: "auto" }}
        />
        <Space wrap>
          <Popover content="Làm mới">
            <Button onClick={() => loadHistory()} icon={<ReloadOutlined />} />
          </Popover>
        </Space>
      </div>

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        Phiếu xử lý kỹ thuật của {assignedCustomer?.companyName || "chi nhánh của bạn"}
      </Typography.Title>

      {!assignedCustomer ? (
        <Empty
          description="Bạn chưa được gán chi nhánh"
          style={{ marginTop: 50 }}
        />
      ) : (
        <Table
          size="small"
          loading={historyLoading}
          columns={columns}
          dataSource={(searchFilteredHistory || []).map((h, idx) => ({
            ...h,
            key: `${h._id || h.id || "history-" + idx}-${idx}`,
          }))}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          scroll={{ x: true }}
          style={{ width: "100%", whiteSpace: "nowrap" }}
          locale={{
            emptyText: <Empty description="Không có phiếu nào" />,
          }}
          bordered
        />
      )}
    </Card>
  );
}
