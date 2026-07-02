// PM2 process definitions for Pubster backend services.
// See docs/BACKEND.md §"Process management (PM2)" and CLAUDE.md §9.
// Deploy is commit -> push -> pull on server -> `scripts/deploy.sh` -> `pm2 reload`.
// NEVER edit the VPS directly (CLAUDE.md §2).
module.exports = {
  apps: [
    {
      name: 'pubster-api',
      // cwd is the API package so the process picks up services/api/.env
      // (loaded by src/config/env.ts) and resolves dist relative to it.
      cwd: './services/api',
      script: 'dist/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
