import React from "react";
import * as Icons from "lucide-react";
import { categoryById } from "../data/categories";

export default function CategoryIcon({ categoryId, size = 16, withBg = false }) {
  const cat = categoryById(categoryId);
  const Icon = Icons[cat.icon] || Icons.MoreHorizontal;
  if (!withBg) return <Icon size={size} color={cat.color} />;
  return (
    <div style={{
      width: size + 16, height: size + 16, borderRadius: "50%",
      background: cat.color + "22", display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon size={size} color={cat.color} />
    </div>
  );
}
