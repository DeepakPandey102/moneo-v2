import React, { useId } from "react";

// The Moneo "M" mark with the cyan → blue → purple brand gradient.
export default function Logo({ size = 30, withText = true, textSize = 22 }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className="mo-logo" style={{ fontSize: textSize }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset="0.5" stopColor="#4F7BFF" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <path
          d="M4 26V7.5c0-1.3 1.6-1.9 2.5-1L16 16l9.5-9.5c.9-.9 2.5-.3 2.5 1V26a2 2 0 0 1-2 2h-2.5a2 2 0 0 1-2-2V15.5L17.4 19.6a2 2 0 0 1-2.8 0L10.5 15.5V26a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
          fill={`url(#g${id})`}
        />
      </svg>
      {withText && <span className="mo-logo-text">Moneo</span>}
    </span>
  );
}
