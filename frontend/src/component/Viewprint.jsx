import React from "react";
import dayjs from "dayjs";
import logoLeft from "../asset/logo.png";

const logoRight =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='60'><rect width='180' height='60' fill='white' stroke='black' stroke-width='1'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Times New Roman' font-size='20'>I-SKY</text></svg>";

const dateFormat = "DD/MM/YYYY";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const toSafeHtml = (value) => {
  const raw = String(value || "");
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const looksLikeHtml = /<[^>]+>/i.test(trimmed);
  if (looksLikeHtml) return raw;
  return escapeHtml(raw).replace(/\r?\n/g, "<br/>");
};

// Preview: Print preview component that displays ticket in printable format.
// Markup/className matches the frontend reference (Riêng biệt backend/frontend/index.html).
export default function Preview({ data = {}, config = {}, translations }) {
  const printCfg = config?.print || {};

    const formatDate = (value) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      return value.format ? value.format(dateFormat) : value;
    };

    const t = (key) => {
    // If translations are provided (same shape as frontend index.html), prefer them.
    if (translations && typeof translations === "object") {
      const keys = key.split(".");
      let value = translations;
      for (const k of keys) value = value ? value[k] : undefined;
      if (value !== undefined && value !== null && value !== "") return value;
    }

    // Fallback Vietnamese labels from app-config.
    const fallback = {
      "print.company": printCfg.company || config?.companyName || "",
      "print.title": printCfg.title || "",

      "print.address": "Địa chỉ",
      "print.companyAddress": printCfg.companyAddress || config?.address || "",

      "print.phone": "Điện thoại",
      "print.companyPhone": printCfg.companyPhone || config?.phone || "",

      "print.fax": "Fax",
      "print.companyFax": printCfg.companyFax || config?.fax || "",

      "print.email": "Email",
      "print.companyEmail": printCfg.companyEmail || config?.email || "",

      "print.ticketNo": printCfg.ticketNo || "Số phiếu",
      "print.date": printCfg.date || "Ngày",
      "print.customer": printCfg.customer || "Khách hàng",
      "print.location": printCfg.location || "Địa chỉ",
      "print.technician": printCfg.technician || "Người thực hiện",
      "print.contact": printCfg.contact || "Người liên hệ",
      "print.serviceFee": printCfg.serviceFee || "Phí dịch vụ",
      "print.workContent": printCfg.workContent || "NỘI DUNG CÔNG VIỆC",
      "print.status": printCfg.status || "1. Tình trạng",
      "print.solution": printCfg.solution || "2. Phương án xử lý",
      "print.result": printCfg.result || "3. Kết quả",

      "print.ratingNote": printCfg.ratingNote || "",
      "print.ratingLow": printCfg.ratingLow || "Không hài lòng",
      "print.ratingHigh": printCfg.ratingHigh || "Rất hài lòng",

      "print.signature1": printCfg.signature1 || "Xác nhận của khách hàng",
      "print.signature2": printCfg.signature2 || "Kỹ thuật viên",
      "print.signatureSub": printCfg.signatureSub || "(Ký tên - Ghi rõ họ tên)",
    };

    return fallback[key] || key;
    };

    return (
     <div className="preview-wrapper-modal">
       <div className="print-page" id="print-area">
        <div className="header">
          <img alt="Bee-Next" className="logo" src={logoLeft} />
          <div className="header-company">
          <div className="company-name-main">{t("print.company")}</div>
            <div className="company-name-sub">{config?.companySub || ""}</div>
          </div>
          <img alt="I-SKY" className="logo" src={logoRight} />
        </div>

      <div className="title">{t("print.title")}</div>
        <div className="subtitle">
          <div className="company-info">
          <div>
            {t("print.address")}: {t("print.companyAddress") || config?.address || ""}
          </div>
          <div>
            {t("print.phone")}: {t("print.companyPhone") || config?.phone || ""} {t("print.fax")}:
            {" "}{t("print.companyFax") || config?.fax || ""}
          </div>
          <div>
            {t("print.email")}: {t("print.companyEmail") || config?.email || ""}
          </div>
          </div>
        </div>

        <table className="info-table">
          <tbody>
            <tr>
            <td className="label">{t("print.ticketNo")}</td>
              <td> {data.soPhieu}</td>
            <td className="label">{t("print.date")}</td>
              <td> {formatDate(data.ngay)}</td>
            </tr>
            <tr>
            <td className="label">{t("print.customer")}</td>
              <td colSpan="3"> {data.khachHang}</td>
            </tr>
            <tr>
            <td className="label">{t("print.location")}</td>
              <td colSpan="3"> {data.diaChi}</td>
            </tr>
            <tr>
            <td className="label">{t("print.technician")}</td>
              <td> {data.nguoiThucHien}</td>
            <td className="label">{t("print.contact")}</td>
              <td> {data.nguoiLienHe}</td>
            </tr>
            <tr>
            <td className="label">{t("print.serviceFee")}</td>
              <td colSpan="3">{data.phiDichVu}</td>
            </tr>
          </tbody>
        </table>

      <div className="section-title">{t("print.workContent")}</div>
        <table className="section-table">
          <tbody>
            <tr>
            <th>{t("print.status")}</th>
              <td>{data.tinhTrang}</td>
            </tr>
            <tr>
            <th>{t("print.solution")}</th>
              <td style={{ lineHeight: 1.5 }}>
                <div
                  style={{ whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{
                    __html: toSafeHtml(data.phuongAnXuLyHtml || data.phuongAnXuLy || ""),
                  }}
                ></div>
              </td>
            </tr>
            <tr>
            <th>{t("print.result")}</th>
              <td className="result-row">
                <div
                  style={{ whiteSpace: "pre-wrap" }}
                  dangerouslySetInnerHTML={{
                    __html: toSafeHtml(data.ketQuaHtml || data.ketQua || ""),
                  }}
                ></div>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rating-row">
        <div>{t("print.ratingNote")}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span>{t("print.ratingLow")}</span>
          <span>{t("print.ratingHigh")}</span>
          </div>
          <div className="rating-grid">
            {[0, 1, 2, 3, 4, 5].map((num) => (
              <div
                key={num}
                className="rating-cell"
                style={{
                  background: String(data.rating) === String(num) ? "#d9eaf7" : "transparent",
                  fontWeight: String(data.rating) === String(num) ? "bold" : "normal",
                }}
              >
                {num}
              </div>
            ))}
          </div>
        </div>

        <div className="signature">
          <div>
            {t("print.signature1")}
              <div className="muted" style={{ marginTop: 8, fontSize: 11 }}>{t("print.signatureSub")}</div>
          </div>
          <div>
            <div>{t("print.signature2")}</div>
            <div className="muted" style={{ marginTop: 4, fontSize: 11, marginBottom: 8 }}>{t("print.signatureSub")}</div>
            {data?.userSignatureDataUrl ? (
              <div style={{textAlign: "center" }}>
                <img 
                  src={data.userSignatureDataUrl} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: 280, 
                    maxHeight: 100,
                    display: "inline-block",
                  }} 
                />
              </div>
            ) : (
              null
            )}
          </div>
        </div>

      <div className="footer-date">{dayjs().format("DD/MM/YYYY HH:mm:ss")}</div>
      </div>
     </div>
    );
}

