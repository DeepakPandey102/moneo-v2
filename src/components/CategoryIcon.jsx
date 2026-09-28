import React from "react";
import {
  UtensilsCrossed, Bus, ShoppingBag, Popcorn, Receipt,
  GraduationCap, HeartPulse, Plane, MoreHorizontal,
} from "lucide-react";
import { categoryById } from "../data/categories";

// Explicit map instead of `import * as Icons from "lucide-react"` — the
// wildcard import used to pull the entire icon library (700kB+) into one
// blocking chunk just to render 9 possible icons.
const ICONS = {
  UtensilsCrossed, Bus, ShoppingBag, Popcorn, Receipt,
  GraduationCap, HeartPulse, Plane, MoreHorizontal,
};

export default function CategoryIcon({ categoryId, size = 16, withBg = false }) {
  const cat = categoryById(categoryId);
  const Icon = ICONS[cat.icon] || MoreHorizontal;
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
