import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Proxy } from '../api';

const parseEmails = (s: string): string[] =>
  s
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter(Boolean);

function GateControl({ p }: { p: Proxy }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [emails, setEmails] = useState(p.gate.emails.join(', '));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['proxies'] });

  const gateMut = useMutation({
    mutationFn: (list: string[]) => api.gateProxy(p.name, list),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });
  const ungateMut = useMutation({
    mutationFn: () => api.ungateProxy(p.name),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });
  const busy = gateMut.isPending || ungateMut.isPending;
  const err = (gateMut.error || ungateMut.error) as Error | null;

  if (!p.accessConfigured) {
    return (
      <div className="mt-3 text-xs text-slate-600">
        🔒 Access gating unavailable — set CF_API_TOKEN / CF_ACCOUNT_ID.
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0 text-sm">
          {p.gate.enabled ? (
            <div>
              <span className="font-medium text-amber-300">
                🔒 Gated · {p.gate.emails.length} allowed
              </span>
              <div className="truncate text-xs text-slate-500">
                {p.gate.emails.join(', ')}
              </div>
            </div>
          ) : (
            <span className="text-slate-400">🔓 Public — anyone</span>
          )}
        </div>
        <button
          onClick={() => {
            setEmails(p.gate.emails.join(', '));
            setEditing(true);
          }}
          className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {p.gate.enabled ? 'Edit gate' : 'Gate'}
        </button>
      </div>
    );
  }

  const list = parseEmails(emails);
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-black/30 p-3">
      <label className="block text-[11px] uppercase tracking-wide text-slate-500">
        Allowed emails (comma or space separated)
      </label>
      <textarea
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
        rows={2}
        placeholder="me@example.com, po@example.com"
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-sky-600"
      />
      {err && <div className="text-xs text-rose-400">{err.message}</div>}
      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || list.length === 0}
          onClick={() => gateMut.mutate(list)}
          className="rounded-lg border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
        >
          {busy ? 'Saving…' : p.gate.enabled ? 'Update gate' : 'Gate it'}
        </button>
        {p.gate.enabled && (
          <button
            disabled={busy}
            onClick={() => ungateMut.mutate()}
            className="rounded-lg border border-rose-700 px-3 py-1 text-xs text-rose-300 hover:bg-rose-900/40 disabled:opacity-40"
          >
            Remove gate
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => setEditing(false)}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProxyCard({ p }: { p: Proxy }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{p.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                p.up
                  ? 'bg-emerald-600/80 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {p.up ? `up · ${p.httpStatus}` : 'down'}
            </span>
          </div>
          <a
            href={`https://${p.hostname}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm text-sky-400 hover:underline"
          >
            {p.hostname}
          </a>
        </div>
        <a
          href={`http://${p.host}:${p.port}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 font-mono text-xs text-slate-300 hover:bg-slate-800"
          title="open the local target"
        >
          {p.host}:{p.port} ↗
        </a>
      </div>

      <div className="mt-3 rounded-lg border border-slate-800 bg-black/30 px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          What's running
        </div>
        <div className={`text-sm ${p.up ? 'text-slate-200' : 'text-slate-500'}`}>
          {p.detected}
          {p.title && p.detected.indexOf(p.title) === -1 && (
            <span className="text-slate-400"> — “{p.title}”</span>
          )}
        </div>
        {(p.server || p.poweredBy) && (
          <div className="mt-1 text-xs text-slate-500">
            {p.poweredBy && <span>powered-by: {p.poweredBy} </span>}
            {p.server && <span>· server: {p.server}</span>}
          </div>
        )}
      </div>

      <GateControl p={p} />
    </div>
  );
}

export function ProxiesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['proxies'],
    queryFn: api.proxies,
    refetchInterval: 8000,
  });

  if (isLoading) return <div className="text-slate-400">Probing proxy ports…</div>;
  if (error) return <div className="text-rose-400">Failed to load proxies.</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Cloudflare tunnel slots → your dev machine. Each maps a public hostname to a
        fixed local port; whatever you run on that port is what gets served.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {data?.map((p) => <ProxyCard key={p.name} p={p} />)}
      </div>
    </div>
  );
}
