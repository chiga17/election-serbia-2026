import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static files in `out/`, for Cloudflare Pages. `npm run build` copies `public/` there.
  output: "export",
  // The dev server is opened at 127.0.0.1 while Next binds the origin to
  // localhost. Without this, dev resources are blocked and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
