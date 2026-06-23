import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function CloudflareCard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cf-settings'],
    queryFn: api.cloudflareSettings,
  });

  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const save = useMutation({
    mutationFn: () =>
      api.updateCloudflareSettings({
        token: token.trim() || undefined,
        accountId: accountId.trim() || undefined,
      }),
    onSuccess: () => {
      setToken('');
      setAccountId('');
      setTestMsg(null);
      qc.invalidateQueries({ queryKey: ['cf-settings'] });
      qc.invalidateQueries({ queryKey: ['proxies'] });
    },
  });
  const test = useMutation({
    mutationFn: api.testCloudflareSettings,
    onSuccess: (r) => setTestMsg(r),
  });

  if (isLoading) return <div className="text-slate-400">Loading settings…</div>;

  const saveErr = save.error as Error | null;
  const nothingToSave = !token.trim() && !accountId.trim();

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-white">Cloudflare Access</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            data?.configured
              ? 'bg-emerald-600/80 text-white'
              : 'bg-slate-700 text-slate-300'
          }`}
        >
          {data?.configured ? `configured · ${data.source}` : 'not configured'}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Powers the gate controls on the Proxies tab. Token needs “Access: Apps and
        Policies = Edit”. Stored encrypted; applies immediately — no restart.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-slate-500">
            API token
            {data?.tokenPreview && (
              <span className="ml-1 normal-case text-slate-600">
                · current {data.tokenPreview}
              </span>
            )}
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={data?.configured ? 'leave blank to keep current' : 'cfut_…'}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-slate-500">
            Account ID
            {data?.accountId && (
              <span className="ml-1 normal-case text-slate-600">
                · current {data.accountId}
              </span>
            )}
          </label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder={
              data?.accountId ? 'leave blank to keep current' : '32-char hex'
            }
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-sky-600"
          />
        </div>

        {saveErr && <div className="text-sm text-rose-400">{saveErr.message}</div>}
        {testMsg && (
          <div
            className={`text-sm ${testMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {testMsg.ok ? '✓ ' : '✗ '}
            {testMsg.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            disabled={save.isPending || nothingToSave}
            onClick={() => save.mutate()}
            className="rounded-lg border border-emerald-700 px-4 py-1.5 text-sm text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
          >
            {save.isPending ? 'Verifying & saving…' : 'Save & verify'}
          </button>
          <button
            disabled={test.isPending || !data?.configured}
            onClick={() => test.mutate()}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            {test.isPending ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-slate-400">
        Integrations and credentials for the admin app. Secrets are encrypted at
        rest and never shown back in full.
      </p>
      <CloudflareCard />
    </div>
  );
}
