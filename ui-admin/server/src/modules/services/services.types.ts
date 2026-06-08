export type SpecialCheckKind = 'zigbee_bridge' | 'pihole_dns';

export interface ServiceDefinition {
  name: string;
  enabled: boolean;
  order: number;
  special_check?: SpecialCheckKind;
  composeFile: string;
  composeFileExists: boolean;
  // Optional container-path to a log file, for services that log to a file
  // instead of stdout (resolved from services.json `log_file` + host mount).
  logFile?: string;
}

export type LogSource = 'stdout' | 'file' | 'none';

export interface ServiceLogs {
  name: string;
  tail: number;
  source: LogSource;
  logs: string;
}

export type ServiceState =
  | 'running'
  | 'exited'
  | 'restarting'
  | 'paused'
  | 'created'
  | 'dead'
  | 'missing'
  | 'unknown';

export type HealthState = 'healthy' | 'unhealthy' | 'starting' | 'none';

export interface SpecialCheckResult {
  check: SpecialCheckKind;
  ok: boolean;
  detail: string;
}

export interface ServiceStatus {
  name: string;
  order: number;
  enabled: boolean;
  present: boolean;
  state: ServiceState;
  health: HealthState;
  restartCount: number | null;
  startedAt: string | null;
  image: string | null;
  special: SpecialCheckResult | null;
}

export type ServiceAction = 'restart' | 'up' | 'down';

export interface ActionResult {
  ok: boolean;
  name: string;
  action: ServiceAction;
  output: string;
}
