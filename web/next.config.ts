import type { NextConfig } from "next";

// Resolve the backend URL and strip anything that would mangle the rewrite
// target — trailing slashes or a trailing `/api` segment that users sometimes
// paste by accident. We want the bare scheme://host so the rewrite can
// append `/api/:path*` cleanly.
function resolveBackend(): string {
  let url =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8080";
  url = url.trim().replace(/\/+$/, ""); // strip trailing slashes
  url = url.replace(/\/api$/, ""); // strip trailing /api if pasted by mistake
  return url;
}

const backend = resolveBackend();

// Surfaced in Vercel's build logs so we can verify the destination at deploy time.
console.log("[opslens] /api proxy target →", backend);

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
