import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Share the monorepo's root .env so a single file configures both the
// agent and the dashboard.
loadEnvConfig(path.resolve(dirname, "../.."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@mantle-edge/shared"],
};

export default nextConfig;
