import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pin the workspace root: a stray package-lock.json in the home directory otherwise makes Next infer the wrong one.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
