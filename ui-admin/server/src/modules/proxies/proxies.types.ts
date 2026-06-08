export interface ProxyDefinition {
  name: string;
  hostname: string; // public Cloudflare hostname (e.g. proxy1.camcosolutions.nl)
  host: string; // local target host (e.g. 192.168.1.50)
  port: number; // local target port
}

export interface ProxyStatus extends ProxyDefinition {
  up: boolean;
  httpStatus: number | null;
  // best-fit description of whatever is answering on the port
  detected: string;
  server: string | null;
  poweredBy: string | null;
  title: string | null;
}
