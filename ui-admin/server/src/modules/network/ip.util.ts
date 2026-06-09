/**
 * Internal / non-LAN IPs we don't want in the device watcher:
 *  - 172.16.0.0/12  → Docker bridge networks (containers on the Pi itself)
 *  - 169.254.0.0/16 → link-local (APIPA)
 * A real network intruder gets a normal LAN address (e.g. 192.168.x) from DHCP,
 * so excluding these only hides the Pi's own containers — never a rogue device.
 */
export function isInternalIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  const m = ip.match(/^(\d+)\.(\d+)\./);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 172 && b >= 16 && b <= 31) return true; // Docker
  if (a === 169 && b === 254) return true; // link-local
  return false;
}
