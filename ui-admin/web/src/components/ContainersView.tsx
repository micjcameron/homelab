import { useQuery } from '@tanstack/react-query';
import { api, Container } from '../api';

function stateBadge(s: string): string {
  if (s === 'running') return 'bg-emerald-600/80 text-white';
  if (s === 'exited' || s === 'dead') return 'bg-rose-600/80 text-white';
  if (s === 'restarting') return 'bg-amber-500/80 text-black';
  return 'bg-slate-700 text-slate-300';
}

export function ContainersView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['containers'],
    queryFn: api.containers,
    refetchInterval: 10_000,
  });

  if (isLoading) return <div className="text-slate-400">Loading containers…</div>;
  if (error) return <div className="text-rose-400">Failed to load containers.</div>;

  const running = data?.filter((c) => c.state === 'running').length ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Every container on the Pi (raw <code className="text-slate-300">docker ps -a</code>) —{' '}
        {running} running of {data?.length ?? 0}.
      </p>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Container</th>
              <th className="hidden px-4 py-2 md:table-cell">Image</th>
              <th className="px-4 py-2">State</th>
              <th className="hidden px-4 py-2 sm:table-cell">Status</th>
              <th className="hidden px-4 py-2 lg:table-cell">Ports</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c: Container) => (
              <tr key={c.id} className="border-t border-slate-800/70">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-100">{c.name}</div>
                  <div className="text-xs text-slate-500 md:hidden">{c.image}</div>
                </td>
                <td className="hidden px-4 py-2 text-xs text-slate-400 md:table-cell">
                  {c.image}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stateBadge(c.state)}`}>
                    {c.state}
                  </span>
                </td>
                <td className="hidden px-4 py-2 text-xs text-slate-400 sm:table-cell">
                  {c.status}
                </td>
                <td className="hidden px-4 py-2 font-mono text-[11px] text-slate-400 lg:table-cell">
                  {c.ports || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
