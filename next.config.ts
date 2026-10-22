import type { NextConfig } from "next";

const empty = "./src/lib/empty-module.ts";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // embedded Postgres for local development ships its own WASM; keep it out of the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
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
