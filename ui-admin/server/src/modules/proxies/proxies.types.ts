export interface ProxyDefinition {
  name: string;
  hostname: string; // public Cloudflare hostname (e.g. proxy1.camcosolutions.nl)
  host: string; // local target host (e.g. 192.168.1.50)
  port: number; // local target port
}

export interface AccessGate {
  enabled: boolean; // is there a Cloudflare Access gate on this hostname?
  emails: string[]; // who's on the allowlist
}

export interface ProxyStatus extends ProxyDefinition {
  up: boolean;
  httpStatus: number | null;
  // best-fit description of whatever is answering on the port
  detected: string;
  server: string | null;
  poweredBy: string | null;
  title: string | null;
  // Cloudflare Access gate state
  gate: AccessGate;
  accessConfigured: boolean; // are CF creds set? (controls whether UI lets you edit)
}
