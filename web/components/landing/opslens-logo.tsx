export function OpslensLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="pulse-grad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M4 16 H10 L13 8 L19 24 L22 16 H28"
        stroke="url(#pulse-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="28" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}
