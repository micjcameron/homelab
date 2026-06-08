export enum DeviceStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  BLOCKED = 'blocked',
}

// A device as discovered from Pi-hole's network table.
export interface DiscoveredDevice {
  mac: string;
  vendor: string | null;
  ip: string | null;
  hostname: string | null;
  lastSeen: number | null; // unix seconds
}
