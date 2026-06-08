import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

function unix(ts: number | null) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-200">{value ?? '—'}</div>
    </div>
  );
}

export function DeviceDetailPanel({ mac }: { mac: string }) {
  const qc = useQueryClient();
  const [nameInput, setNameInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['device-detail', mac],
    queryFn: () => api.deviceDetail(mac),
  });

  useEffect(() => {
    setNameInput(data?.device?.preferredName ?? '');
  }, [data?.device?.preferredName]);

  const rename = useMutation({
    mutationFn: (n: string) => api.renameDevice(mac, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device-detail', mac] });
    },
  });

  if (isLoading)
    return <div className="p-4 text-sm text-slate-400">Loading details…</div>;

  const p = data?.pihole;
  const dev = data?.device;
  const dirty = (dev?.preferredName ?? '') !== nameInput;

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="grow">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">
            Preferred name
          </div>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. Living Room TV"
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-sky-500"
          />
        </div>
        <button
          disabled={!dirty || rename.isPending}
          onClick={() => rename.mutate(nameInput.trim())}
          className="rounded-lg border border-sky-700 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-900/40 disabled:opacity-40"
        >
          {rename.isPending ? 'Saving…' : 'Save name'}
        </button>
      </div>

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="MAC" value={<span className="font-mono">{mac}</span>} />
        <Field label="Vendor" value={p?.vendor ?? dev?.vendor} />
        <Field label="Interface" value={p?.interface} />
        <Field label="DNS queries" value={p?.numQueries?.toLocaleString()} />
        <Field label="First seen (Pi-hole)" value={unix(p?.firstSeen ?? null)} />
        <Field label="Last query" value={unix(p?.lastQuery ?? null)} />
        <Field
          label="IP addresses"
          value={
            p?.ips?.length
              ? p.ips.map((x) => (
                  <div key={x.ip}>
                    {x.ip}
                    {x.name ? ` (${x.name})` : ''}
                  </div>
                ))
              : (dev?.ip ?? '—')
          }
        />
        <Field label="Status" value={dev?.status} />
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
          Top domains queried{' '}
          <span className="text-slate-600">(what this device talks to)</span>
        </div>
        {data?.topDomains?.length ? (
          <div className="max-h-56 space-y-1 overflow-auto rounded-lg border border-slate-800 bg-black/40 p-2">
            {data.topDomains.map((d) => (
              <div key={d.domain} className="flex justify-between gap-3 text-xs">
                <span className="truncate font-mono text-slate-300">{d.domain}</span>
                <span className="shrink-0 text-slate-500">{d.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            No recent DNS queries (device may not use Pi-hole for DNS).
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
