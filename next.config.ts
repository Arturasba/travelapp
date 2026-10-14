import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {source:"/",destination:"/en",permanent:false},
      {source:"/places/:path*",destination:"/en/places/:path*",permanent:true},
      {source:"/journal",destination:"/en",permanent:true},
      {source:"/:lang(en|lt)/journal",destination:"/:lang",permanent:true},
    ];
  },
  images: {
    qualities: [75,85,90],
    localPatterns: [
      { pathname: "/destinations/**" },
      { pathname: "/_next/static/media/**", search: "" },
    ],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
