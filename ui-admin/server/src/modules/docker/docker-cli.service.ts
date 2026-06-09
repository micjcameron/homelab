import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { CommandExecutionError } from '../../shared/exceptions/errors';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Single, safe wrapper around the docker / docker-compose CLI.
 * Uses execFile with argv arrays (NO shell) so user-derived values (service
 * names) can never be interpreted as shell. Mirrors what manage.sh does.
 */
@Injectable()
export class DockerCliService {
  private readonly logger = new Logger(DockerCliService.name);
  private readonly bin: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.bin = this.config.get<string>('app.dockerBin', 'docker');
    this.timeoutMs = this.config.get<number>('app.commandTimeoutMs', 120_000);
  }

  /** Run a docker subcommand. Resolves even on non-zero exit (check .code). */
  private run(args: string[]): Promise<ExecResult> {
    return new Promise((resolve) => {
      execFile(
        this.bin,
        args,
        { timeout: this.timeoutMs, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const code =
            err && typeof (err as any).code === 'number'
              ? (err as any).code
              : err
                ? 1
                : 0;
          resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code });
        },
      );
    });
  }

  /** Run and throw on non-zero exit. */
  private async runOrThrow(args: string[]): Promise<ExecResult> {
    const res = await this.run(args);
    if (res.code !== 0) {
      this.logger.error(`docker ${args.join(' ')} -> ${res.code}: ${res.stderr}`);
      throw new CommandExecutionError(
        `docker ${args[0]} failed`,
        res.code,
        res.stderr.trim(),
      );
    }
    return res;
  }

  /** `docker inspect <name>` parsed; null if the container does not exist. */
  async inspect(name: string): Promise<any | null> {
    const res = await this.run(['inspect', name]);
    if (res.code !== 0) return null;
    try {
      const arr = JSON.parse(res.stdout);
      return Array.isArray(arr) && arr.length ? arr[0] : null;
    } catch {
      return null;
    }
  }

  async logs(name: string, tail = 200): Promise<string> {
    const res = await this.run(['logs', '--tail', String(tail), name]);
    // docker writes container stderr to our stderr; include both.
    return `${res.stdout}${res.stderr}`.trim();
  }

  /** manage.sh recreate sequence: stop || true; rm || true; compose up -d. */
  async recreate(name: string, composeFile: string): Promise<string> {
    await this.run(['stop', name]); // tolerate "no such container"
    await this.run(['rm', name]);
    const res = await this.runOrThrow([
      'compose',
      '-f',
      composeFile,
      'up',
      '-d',
    ]);
    return `${res.stdout}${res.stderr}`.trim();
  }

  async composeUp(composeFile: string): Promise<string> {
    const res = await this.runOrThrow([
      'compose',
      '-f',
      composeFile,
      'up',
      '-d',
    ]);
    return `${res.stdout}${res.stderr}`.trim();
  }

  async composeDown(composeFile: string): Promise<string> {
    const res = await this.runOrThrow(['compose', '-f', composeFile, 'down']);
    return `${res.stdout}${res.stderr}`.trim();
  }

  /** `docker exec <container> sh -lc "<cmd>"` — used by special checks. */
  async exec(container: string, shellCmd: string): Promise<ExecResult> {
    return this.run(['exec', container, 'sh', '-lc', shellCmd]);
  }

  /** Is the docker daemon reachable? */
  async ping(): Promise<boolean> {
    const res = await this.run(['version', '--format', '{{.Server.Version}}']);
    return res.code === 0 && res.stdout.trim().length > 0;
  }

  /** All containers (running + stopped) as parsed `docker ps -a` records. */
  async ps(): Promise<any[]> {
    const res = await this.run(['ps', '-a', '--no-trunc', '--format', '{{json .}}']);
    if (res.code !== 0) return [];
    return res.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}
