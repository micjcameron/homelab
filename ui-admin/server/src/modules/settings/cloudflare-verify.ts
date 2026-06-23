const API = 'https://api.cloudflare.com/client/v4';

/**
 * Confirm a token is valid AND can actually manage Access apps for the account —
 * run before saving so a bad/expired/wrong-scope token is never trusted.
 */
export async function verifyCloudflareCreds(
  token: string,
  accountId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const v = await fetch(`${API}/user/tokens/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const vj: any = await v.json();
    if (!vj?.success)
      return { ok: false, message: 'Token rejected by Cloudflare (invalid or revoked).' };

    const a = await fetch(`${API}/accounts/${accountId}/access/apps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const aj: any = await a.json();
    if (!aj?.success) {
      const msg =
        aj?.errors?.map((e: any) => e.message).join('; ') ||
        'cannot list Access apps for this account';
      return { ok: false, message: `Token valid, but can't manage Access here: ${msg}` };
    }
    return { ok: true, message: 'Verified — token can manage Access apps for this account.' };
  } catch (e) {
    return { ok: false, message: `Cloudflare unreachable: ${String(e)}` };
  }
}
