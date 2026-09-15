import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 on natiivmoodul – seda ei tohi bundlerisse kaasata.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
