// Opslens brand mark — hexagonal lens housing with a gradient optical
// element inside. The hex evokes a camera aperture; the inner circle is
// the lens itself. Cyan → violet gradient matches the app accent palette.
//
// Each instance generates its own gradient id so two logos in the same
// page don't collide when one inherits the other's def.
"use client";

import { useId } from "react";

export function OpslensLogo({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gradId = `opslens-grad-${id}`;

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="4"
          y1="4"
          x2="28"
          y2="28"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="oklch(0.81 0.14 200)" />
          <stop offset="1" stopColor="oklch(0.74 0.18 295)" />
        </linearGradient>
      </defs>

      {/* Hexagonal lens housing */}
      <path
        d="M16 2.5 L27.5 9 L27.5 23 L16 29.5 L4.5 23 L4.5 9 Z"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Inner gradient circle — the optical element */}
      <circle cx="16" cy="16" r="5.5" fill={`url(#${gradId})`} />

      {/* Subtle highlight on the lens to suggest depth */}
      <circle cx="13.5" cy="13.5" r="1.6" fill="white" fillOpacity="0.35" />
    </svg>
  );
}
