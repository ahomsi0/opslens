import type { NextConfig } from "next";

// Proxy all /api/* requests through Vercel to the Go backend on Render.
// Without this, the session cookie set by the backend lives on Render's
// domain and the Vercel middleware can't see it. With this, every /api
// call is same-origin and cookies behave normally.
//
// Set BACKEND_URL on Vercel to the backend's URL (e.g. https://opslens-l558.onrender.com).
const backend =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts"],
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
    ];
  },
};

export default config;
