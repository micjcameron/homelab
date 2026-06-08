import { useQuery } from '@tanstack/react-query';
import { api, Proxy } from '../api';

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
