import type { NextConfig } from "next";

const empty = "./src/lib/empty-module.ts";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      "@coinbase/cdp-sdk": empty,
    },
  },
};

export default nextConfig;
