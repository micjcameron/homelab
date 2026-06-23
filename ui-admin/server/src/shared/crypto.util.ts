import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// AES-256-GCM secret encryption. The key is derived from JWT_SECRET so there's
// no extra env var to manage, and a stolen DB dump alone is useless — decrypting
// also requires the server's env (defence in depth over plaintext-in-.env).
const ALGO = 'aes-256-gcm';
let cached: { secret: string; key: Buffer } | null = null;

function keyFrom(secret: string): Buffer {
  if (cached?.secret === secret) return cached.key;
  const key = scryptSync(secret, 'ui-admin-settings-v1', 32);
  cached = { secret, key };
  return key;
}

/** Returns "v1:iv:tag:data" (all base64). */
export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyFrom(secret), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64'),
    tag.toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const [v, ivB, tagB, dataB] = payload.split(':');
  if (v !== 'v1' || !ivB || !tagB || !dataB) throw new Error('bad ciphertext');
  const decipher = createDecipheriv(ALGO, keyFrom(secret), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
