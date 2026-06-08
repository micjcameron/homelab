import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { ProxyDefinition, ProxyStatus } from './proxies.types';

interface Detection {
  detected: string;
  title: string | null;
}

@Injectable()
export class ProxiesService {
  private readonly logger = new Logger(ProxiesService.name);
  private readonly proxiesJson: string;

  constructor(private readonly config: ConfigService) {
    this.proxiesJson = this.config.get<string>('app.proxiesJson')!;
  }

  private async definitions(): Promise<ProxyDefinition[]> {
    try {
      const raw = await readFile(this.proxiesJson, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.proxies) ? parsed.proxies : [];
    } catch (e) {
      this.logger.warn(`cannot read ${this.proxiesJson}: ${String(e)}`);
      return [];
    }
  }

  async list(): Promise<ProxyStatus[]> {
    const defs = await this.definitions();
    return Promise.all(defs.map((d) => this.probe(d)));
  }

  /** Hit http://host:port/ and best-effort identify what's answering. */
  private async probe(def: ProxyDefinition): Promise<ProxyStatus> {
    const url = `http://${def.host}:${def.port}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'user-agent': 'ui-admin-proxy-probe' },
      });
      const server = res.headers.get('server');
      const poweredBy = res.headers.get('x-powered-by');
      const contentType = res.headers.get('content-type') || '';
      let body = '';
      try {
        body = (await res.text()).slice(0, 4000);
      } catch {
        /* ignore body read errors */
      }
      const { detected, title } = this.detect(server, poweredBy, contentType, body, res.status);
      return {
        ...def,
        up: true,
        httpStatus: res.status,
        detected,
        server,
        poweredBy,
        title,
      };
    } catch {
      return {
        ...def,
        up: false,
        httpStatus: null,
        detected: 'nothing running',
        server: null,
        poweredBy: null,
        title: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private detect(
    server: string | null,
    poweredBy: string | null,
    contentType: string,
    body: string,
    status: number,
  ): Detection {
    const pb = (poweredBy || '').toLowerCase();
    const sv = (server || '').toLowerCase();
    const b = body.toLowerCase();
    const ct = contentType.toLowerCase();
    const title = body.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || null;

    if (b.includes('@vite/client') || b.includes('/@vite/'))
      return { detected: 'Vite dev server (frontend)', title };
    if (pb.includes('next') || b.includes('__next_data__') || b.includes('/_next/'))
      return { detected: 'Next.js app', title };
    if (b.includes('data-reactroot') || (b.includes('id="root"') && ct.includes('html')))
      return { detected: 'React app', title };
    if (pb.includes('express'))
      return { detected: 'Express / NestJS API', title };
    if (sv.includes('nginx')) return { detected: 'nginx', title };
    if (sv.includes('caddy')) return { detected: 'Caddy', title };
    if (sv.includes('apache')) return { detected: 'Apache', title };
    if (ct.includes('application/json'))
      return { detected: 'JSON API', title: body.replace(/\s+/g, ' ').slice(0, 80) || null };
    if (title) return { detected: `Web app — “${title}”`, title };
    if (ct.includes('text/html')) return { detected: 'HTTP web service', title };
    return { detected: `HTTP service (${status})`, title };
  }
}
