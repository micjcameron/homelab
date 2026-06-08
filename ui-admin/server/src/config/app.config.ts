import { registerAs } from '@nestjs/config';

// NOTE: resolve everything from process.env INSIDE the factory — it runs after
// ConfigModule has loaded the .env files (top-level consts would read too early).
export const getConfig = () => {
  // REPO_PATH is where the homelab repo is mounted in the container (/repo).
  // For local dev on the Mac, point it at the repo root via server/.env.local.
  const repoPath = process.env.REPO_PATH || '/repo';

  return {
  nodeEnv: process.env.NODE_ENV || 'development',
  name: process.env.APP_NAME || 'ui-admin',
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8090,
  frontendDomain: process.env.FRONTEND_DOMAIN,

  // Homelab repo layout (paths the backend reads/operates on)
  repoPath,
  stacksDir: process.env.STACKS_DIR || `${repoPath}/home-automation/stacks`,
  servicesJson:
    process.env.SERVICES_JSON || `${repoPath}/home-automation/services.json`,
  scriptsDir: process.env.SCRIPTS_DIR || `${repoPath}/personal-scripts`,

  // Docker control
  dockerBin: process.env.DOCKER_BIN || 'docker',
  commandTimeoutMs: process.env.COMMAND_TIMEOUT_MS
    ? parseInt(process.env.COMMAND_TIMEOUT_MS, 10)
    : 120_000,

  // Health check endpoint HA exposes (network_mode: host -> localhost on the Pi)
  haHealthUrl: process.env.HA_HEALTH_URL || 'http://localhost:8123/',

  // Host filesystem path to measure disk usage against (a host mount). The repo
  // mount (/repo) or home mount (/host-home) both sit on the Pi's root fs.
  hostFsPath: process.env.HOST_FS_PATH || '/host-home',

  // Where the Pi's home dir is mounted in the container — used to read service
  // log files for services that log to a file instead of stdout (e.g. mosquitto).
  hostHomeMount: process.env.HOST_HOME_MOUNT || '/host-home',

  // Database (Postgres) — NODE_ENV=local resolves to localhost for dev.
  databaseHost:
    process.env.NODE_ENV === 'local'
      ? 'localhost'
      : process.env.DB_HOST || 'ui-admin-db',
  databasePort: process.env.DB_PORT || '5432',
  databaseUser: process.env.DB_USER || 'uiadmin',
  databasePassword: process.env.DB_PASSWORD || 'uiadmin',
  databaseName: process.env.DB_NAME || 'uiadmin',

  // JWT / auth
  jwtSecret: process.env.JWT_SECRET || 'changeMeJwtSecret',
  jwtAccessExpiry: process.env.ACCESS_TOKEN_EXPIRY || '12h',

  // Admin bootstrap (seeded into the DB on boot if set)
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',

  // Telegram (reuse the lifeline bot). polling now; webhook in Phase 4.
  telegramMode: process.env.TELEGRAM_MODE || 'polling',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  telegramEnabled:
    !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,

  // Pi-hole (device discovery + blocking) — Phase 6
  piholeUrl: process.env.PIHOLE_URL || 'http://host.docker.internal',
  piholePassword: process.env.PIHOLE_PASSWORD || '',
  networkWatchEnabled: !!process.env.PIHOLE_PASSWORD,
  networkWatchIntervalMs: process.env.NETWATCH_INTERVAL_MS
    ? parseInt(process.env.NETWATCH_INTERVAL_MS, 10)
    : 5 * 60 * 1000,
  routerIp: process.env.ROUTER_IP || '192.168.1.1',
  };
};

export default registerAs('app', getConfig);

export type AppConfig = ReturnType<typeof getConfig>;
