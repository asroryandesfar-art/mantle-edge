// PM2 process config for the MantleEdge multi-agent trading system.
// Usage (from apps/agent, after `pnpm build`):
//   pm2 start ecosystem.config.cjs
//   pm2 logs mantle-edge-agent
//   pm2 save && pm2 startup   # persist across reboots

module.exports = {
  apps: [
    {
      name: "mantle-edge-agent",
      script: "dist/multiAgentIndex.js",
      cwd: __dirname,
      // apps/agent/src/config.ts loads the monorepo root .env itself via dotenv.
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 10,
      max_memory_restart: "512M",
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      time: true,
    },
  ],
};
