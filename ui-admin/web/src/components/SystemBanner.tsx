import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

function fmtUptime(s: number | null) {
  if (s == null) return '—';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
}

function Chip({
  label,
  value,
  warn,
  title,
}: {
  label: string;
  value: string;
  warn?: boolean;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2"
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${warn ? 'text-amber-400' : 'text-slate-200'}`}>
        {value}
      </div>
    </div>
  );
}

export function SystemBanner() {
  const { data } = useQuery({
    queryKey: ['system'],
    queryFn: api.system,
    refetchInterval: 10_000,
  });
  if (!data) return null;
  const loadPct =
    data.load1 != null && data.cpuCount
      ? Math.round((data.load1 / data.cpuCount) * 100)
      : null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
      <Chip label="Temp" value={data.tempC != null ? `${data.tempC}°C` : '—'} warn={(data.tempC ?? 0) > 70} />
      <Chip
        label="CPU load"
        value={loadPct != null ? `${loadPct}%` : '—'}
        warn={(loadPct ?? 0) > 90}
        title={`load avg ${data.load1?.toFixed(2) ?? '—'} on ${data.cpuCount} cores (1 min)`}
      />
      <Chip
        label="Memory"
        value={data.memory ? `${data.memory.usedPct}%` : '—'}
        warn={(data.memory?.usedPct ?? 0) > 85}
      />
      <Chip
        label="Disk"
        value={data.disk ? `${data.disk.usedPct}%` : '—'}
        warn={(data.disk?.usedPct ?? 0) > 85}
      />
      <Chip label="Uptime" value={fmtUptime(data.uptimeSeconds)} />
      <Chip label="Docker" value={data.dockerOk ? 'OK' : 'DOWN'} warn={!data.dockerOk} />
    </div>
  );
}
