import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Device } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApproveDialog } from '../components/ApproveDialog';
import { DeviceDetailPanel } from '../components/DeviceDetailPanel';

const STATUS_ORDER: Record<Device['status'], number> = {
  pending: 0,
  blocked: 1,
  approved: 2,
};
const STATUS_BADGE: Record<Device['status'], string> = {
  pending: 'bg-amber-500/80 text-black',
  approved: 'bg-emerald-600/80 text-white',
  blocked: 'bg-rose-600/80 text-white',
};

function name(d: Device) {
  return d.preferredName || d.hostname || d.vendor || d.mac;
}
function suggestedName(d: Device) {
  return d.preferredName || d.hostname || d.vendor || '';
}
function fmt(ts: string | null) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NetworkPage() {
  const qc = useQueryClient();
  const [confirmBlock, setConfirmBlock] = useState<Device | null>(null);
  const [approveTarget, setApproveTarget] = useState<Device | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: api.devices,
    refetchInterval: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['devices'] });
  const approveMut = useMutation({
    mutationFn: ({ mac, name }: { mac: string; name: string }) =>
      api.approveDevice(mac, name),
    onSettled: invalidate,
  });
  const blockMut = useMutation({
    mutationFn: (mac: string) => api.blockDevice(mac),
    onSettled: invalidate,
  });
  const busy = approveMut.isPending || blockMut.isPending;

  if (isLoading) return <div className="text-slate-400">Loading devices…</div>;

  const devices = [...(data ?? [])].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      name(a).localeCompare(name(b)),
  );
  const pending = devices.filter((d) => d.status === 'pending');

  const ActionBtns = ({ d }: { d: Device }) => (
    <div className="flex gap-2">
      {d.status !== 'approved' && (
        <button
          disabled={busy}
          onClick={() => setApproveTarget(d)}
          className="rounded-lg border border-emerald-700 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-900/40 disabled:opacity-40"
        >
          Approve
        </button>
      )}
      {d.status !== 'blocked' && (
        <button
          disabled={busy}
          onClick={() => setConfirmBlock(d)}
          className="rounded-lg border border-rose-700 px-3 py-1 text-xs text-rose-300 hover:bg-rose-900/40 disabled:opacity-40"
        >
          Block
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-700/50 bg-amber-950/20 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-300">
            ⚠ {pending.length} new device{pending.length > 1 ? 's' : ''} to review
          </h2>
          <div className="space-y-2">
            {pending.map((d) => (
              <div
                key={d.mac}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
              >
                <div>
                  <div className="font-medium text-white">{name(d)}</div>
                  <div className="text-xs text-slate-500">
                    {d.ip ?? '—'} · {d.mac} · {d.vendor ?? 'unknown vendor'}
                  </div>
                </div>
                <ActionBtns d={d} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Device</th>
              <th className="px-4 py-2">IP</th>
              <th className="hidden px-4 py-2 sm:table-cell">MAC</th>
              <th className="hidden px-4 py-2 md:table-cell">Last seen</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => {
              const isOpen = expanded === d.mac;
              return (
                <Fragment key={d.mac}>
                  <tr
                    className="cursor-pointer border-t border-slate-800/70 hover:bg-slate-900/40"
                    onClick={() => setExpanded(isOpen ? null : d.mac)}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">{isOpen ? '▾' : '▸'}</span>
                        <span className="font-medium text-slate-100">{name(d)}</span>
                      </div>
                      <div className="pl-5 text-xs text-slate-500">{d.vendor ?? ''}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-300">{d.ip ?? '—'}</td>
                    <td className="hidden px-4 py-2 font-mono text-xs text-slate-400 sm:table-cell">
                      {d.mac}
                    </td>
                    <td className="hidden px-4 py-2 text-xs text-slate-400 md:table-cell">
                      {fmt(d.lastSeen)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[d.status]}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <ActionBtns d={d} />
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-slate-800/40 bg-slate-950/40">
                      <td colSpan={6}>
                        <DeviceDetailPanel mac={d.mac} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmBlock}
        options={
          confirmBlock
            ? {
                title: `Block ${name(confirmBlock)}?`,
                message: `This DNS-blocks ${confirmBlock.mac} via Pi-hole (soft block). For a hard block, also block it at your router.`,
                confirmLabel: 'Block',
                tone: 'rose',
              }
            : null
        }
        onConfirm={() => {
          if (confirmBlock) blockMut.mutate(confirmBlock.mac);
          setConfirmBlock(null);
        }}
        onCancel={() => setConfirmBlock(null)}
      />

      <ApproveDialog
        open={!!approveTarget}
        deviceLabel={
          approveTarget
            ? `${approveTarget.vendor ?? 'Unknown'} · ${approveTarget.ip ?? '—'} · ${approveTarget.mac}`
            : ''
        }
        suggested={approveTarget ? suggestedName(approveTarget) : ''}
        onConfirm={(preferredName) => {
          if (approveTarget)
            approveMut.mutate({ mac: approveTarget.mac, name: preferredName });
          setApproveTarget(null);
        }}
        onCancel={() => setApproveTarget(null)}
      />
    </div>
  );
}
