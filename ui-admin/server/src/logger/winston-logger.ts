import * as winston from 'winston';

// Aligned, colored console formatter (same spirit as socialContentGenerator,
// minus the request-context enricher which this service doesn't need yet).
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const padRight = (s: string, width: number) => {
  const plain = stripAnsi(s);
  if (plain.length >= width) return s.slice(0, width);
  return s + ' '.repeat(width - plain.length);
};

const colorLevel = (levelUpper: string) => {
  switch (levelUpper) {
    case 'ERROR':
      return `\x1b[31m${levelUpper}\x1b[0m`;
    case 'WARN':
      return `\x1b[33m${levelUpper}\x1b[0m`;
    case 'INFO':
      return `\x1b[32m${levelUpper}\x1b[0m`;
    case 'DEBUG':
      return `\x1b[36m${levelUpper}\x1b[0m`;
    case 'VERBOSE':
      return `\x1b[35m${levelUpper}\x1b[0m`;
    default:
      return levelUpper;
  }
};

const alignedConsole = winston.format.printf((info) => {
  const app = 'UIA';
  const ts = info.timestamp;
  const levelUpper = String(info.level).toUpperCase();
  const colLevel = padRight(colorLevel(levelUpper), 7);
  const colCtx = padRight(info.context ? String(info.context) : 'MainApp', 22);
  return `[${app}] ${ts} ${colLevel} [${colCtx}] ${info.message}`;
});

export const winstonLogger = {
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: () => new Date().toISOString() }),
        alignedConsole,
      ),
    }),
    new winston.transports.File({
      filename: 'logs/app.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      maxsize: 5_000_000,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
