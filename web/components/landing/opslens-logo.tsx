// Opslens brand mark — hexagonal lens housing with a solid optical
// element inside. Single-tone; takes its color from the parent via
// currentColor so callers control it with `text-...` classes.
export function OpslensLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Hexagonal lens housing */}
      <path
        d="M16 2.5 L27.5 9 L27.5 23 L16 29.5 L4.5 23 L4.5 9 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Inner solid circle — the optical element */}
      <circle cx="16" cy="16" r="5.5" fill="currentColor" />
    </svg>
  );
}
