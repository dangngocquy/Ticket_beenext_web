import React from "react";
import { Avatar } from "antd";

const AVATAR_COLORS = [
  "#ed3237",
  "#1677ff",
  "#13a8a8",
  "#722ed1",
  "#389e0d",
  "#d46b08",
  "#c41d7f",
  "#096dd9",
];

const normalizeName = (value) => String(value || "").trim();

const getAvatarLetter = (name) => {
  const cleanName = normalizeName(name);
  if (!cleanName) return "?";
  return cleanName.charAt(0).toUpperCase();
};

const getAvatarColor = (name) => {
  const cleanName = normalizeName(name).toLowerCase();
  if (!cleanName) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < cleanName.length; i += 1) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function UserAvatar({ name, style, children, ...props }) {
  return (
    <Avatar
      {...props}
      style={{
        backgroundColor: getAvatarColor(name),
        ...(style || {}),
      }}
    >
      {children || getAvatarLetter(name)}
    </Avatar>
  );
}
