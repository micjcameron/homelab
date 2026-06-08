import { Injectable } from '@nestjs/common';
import { DockerCliService } from '../docker/docker-cli.service';
import { SpecialCheckKind, SpecialCheckResult } from './services.types';

/**
 * Mirrors lifeline.sh's deeper probes so the dashboard agrees with the
 * auto-repair loop.
 *   zigbee_bridge: mosquitto_sub zigbee2mqtt/bridge/state must contain "online"
 *   pihole_dns:    `dig +short pi.hole` inside the pihole container must succeed
 */
@Injectable()
export class SpecialChecksService {
  constructor(private readonly docker: DockerCliService) {}

  async run(kind: SpecialCheckKind): Promise<SpecialCheckResult> {
    switch (kind) {
      case 'zigbee_bridge': {
        const res = await this.docker.exec(
          'mosquitto',
          'mosquitto_sub -t zigbee2mqtt/bridge/state -C 1 -W 3',
        );
        const out = `${res.stdout}${res.stderr}`.trim();
        const ok = out.includes('online');
        return {
          check: kind,
          ok,
          detail: ok ? 'bridge online' : `bridge not online: '${out || 'no response'}'`,
        };
      }
      case 'pihole_dns': {
        const res = await this.docker.exec('pihole', 'dig +short pi.hole');
        const ok = res.code === 0 && res.stdout.trim().length > 0;
        return {
          check: kind,
          ok,
          detail: ok ? 'DNS responding' : 'DNS unresponsive',
        };
      }
      default:
        return { check: kind, ok: false, detail: 'unknown check' };
    }
  }
}
