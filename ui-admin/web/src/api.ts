export interface ServiceStatus {
  name: string;
  order: number;
  enabled: boolean;
  present: boolean;
  state: string;
  health: string;
  restartCount: number | null;
  startedAt: string | null;
  image: string | null;
  special: { check: string; ok: boolean; detail: string } | null;
}

export interface SystemHealth {
  uptimeSeconds: number | null;
  tempC: number | null;
  cpuCount: number;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memory: { totalMb: number; usedMb: number; usedPct: number } | null;
  disk: { totalGb: number; usedGb: number; usedPct: number } | null;
  dockerOk: boolean;
}

export interface ServiceLogs {
  name: string;
  tail: number;
  source: 'stdout' | 'file' | 'none';
  logs: string;
}

export interface Device {
  mac: string;
  vendor: string | null;
  ip: string | null;
  hostname: string | null;
  preferredName: string | null;
  status: 'pending' | 'approved' | 'blocked';
  randomMac: boolean;
  firstSeen: string;
  lastSeen: string | null;
}

export interface DeviceDetail {
  device: Device | null;
  pihole: {
    interface: string | null;
    firstSeen: number | null;
    lastQuery: number | null;
    numQueries: number | null;
    vendor: string | null;
    ips: { ip: string; name: string | null; lastSeen: number | null }[];
  } | null;
  topDomains: { domain: string; count: number }[];
}

export interface Proxy {
  name: string;
  hostname: string;
  host: string;
  port: number;
  up: boolean;
  httpStatus: number | null;
  detected: string;
  server: string | null;
  poweredBy: string | null;
  title: string | null;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  ports: string;
  networks: string;
  runningFor: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.message || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ accessToken: string; user: { username: string; role: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
    ),
  me: () => request<{ user: { username: string; role: string } | null }>('/auth/me'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  services: () => request<ServiceStatus[]>('/services'),
  serviceAction: (name: string, action: 'restart' | 'up' | 'down') =>
    request<{ ok: boolean; output: string }>(`/services/${name}/${action}`, {
      method: 'POST',
    }),
  serviceLogs: (name: string, tail = 200) =>
    request<ServiceLogs>(`/services/${name}/logs?tail=${tail}`),

  system: () => request<SystemHealth>('/system'),

  proxies: () => request<Proxy[]>('/proxies'),
  containers: () => request<Container[]>('/containers'),

  devices: () => request<Device[]>('/network/devices'),
  deviceDetail: (mac: string) =>
    request<DeviceDetail>(`/network/devices/${encodeURIComponent(mac)}/detail`),
  approveDevice: (mac: string, preferredName?: string) =>
    request<Device>(`/network/devices/${encodeURIComponent(mac)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ preferredName }),
    }),
  blockDevice: (mac: string) =>
    request<Device>(`/network/devices/${encodeURIComponent(mac)}/block`, {
      method: 'POST',
    }),
  renameDevice: (mac: string, preferredName: string) =>
    request<Device>(`/network/devices/${encodeURIComponent(mac)}/name`, {
      method: 'PUT',
      body: JSON.stringify({ preferredName }),
    }),
};
