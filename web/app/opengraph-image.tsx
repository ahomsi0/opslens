import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Opslens — AI-native infrastructure monitoring";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0B0F",
          color: "#fafafa",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Top row: mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2.5 L27.5 9 L27.5 23 L16 29.5 L4.5 23 L4.5 9 Z"
              stroke="#22D3EE"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="16" cy="16" r="5.5" fill="#22D3EE" />
          </svg>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Opslens
          </div>
        </div>

        {/* Headline + sub */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              maxWidth: 1000,
            }}
          >
            Production telemetry,{" "}
            <span style={{ color: "#22D3EE" }}>explained by AI.</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.65)",
              maxWidth: 880,
              lineHeight: 1.35,
            }}
          >
            Live deployment, infrastructure, and AI-powered incident insight
            for modern engineering teams.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span>vercel</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>render</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>railway</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>supabase</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>neon</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>docker</span>
          </div>
          <div>opslens-ah.vercel.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
