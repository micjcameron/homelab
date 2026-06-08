import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ServiceStatus } from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { LogsModal } from './LogsModal';

type Action = 'restart' | 'up' | 'down';
const actionTone: Record<Action, 'sky' | 'emerald' | 'rose'> = {
  restart: 'sky',
  up: 'emerald',
  down: 'rose',
};

function badge(s: ServiceStatus): { text: string; cls: string } {
  if (!s.present || s.state === 'missing')
    return { text: 'missing', cls: 'bg-slate-700 text-slate-300' };
  if (s.state !== 'running')
    return { text: s.state, cls: 'bg-rose-600/80 text-white' };
  if (s.health === 'unhealthy' || (s.special && !s.special.ok))
    return { text: 'unhealthy', cls: 'bg-amber-500/80 text-black' };
  return { text: s.health === 'healthy' ? 'healthy' : 'running', cls: 'bg-emerald-600/80 text-white' };
}

export function ServiceCard({ service }: { service: ServiceStatus }) {
  const qc = useQueryClient();
  const [logsOpen, setLogsOpen] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const b = badge(service);

  const action = useMutation({
    mutationFn: (a: Action) => api.serviceAction(service.name, a),
    onSettled: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });

  const isUp = service.state === 'running';

  const Btn = ({
    a,
    label,
    danger,
    disabled,
  }: {
    a: Action;
    label: string;
    danger?: boolean;
    disabled?: boolean;
  }) => (
    <button
      disabled={action.isPending || disabled}
      onClick={() => setPending(a)}
      className={`rounded-lg px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'border border-rose-700 text-rose-300 hover:bg-rose-900/40'
          : 'border border-slate-700 text-slate-200 hover:bg-slate-800'
      }`}
    >
      {action.isPending && action.variables === a ? '…' : label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{service.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
              {b.text}
            </span>
            {!service.enabled && (
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                not deployed
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{service.image ?? '—'}</div>
          {service.special && (
            <div className={`mt-1 text-xs ${service.special.ok ? 'text-emerald-400' : 'text-amber-400'}`}>
              {service.special.check}: {service.special.detail}
            </div>
          )}
        </div>
        {service.restartCount != null && (
          <span className="text-[11px] text-slate-500">restarts: {service.restartCount}</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Btn a="restart" label="Restart" />
        <Btn a="up" label="Up" disabled={isUp} />
        <Btn a="down" label="Down" danger disabled={!isUp} />
        <button
          onClick={() => setLogsOpen(true)}
          className="ml-auto rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Logs
        </button>
      </div>

      {action.isError && (
        <div className="mt-2 text-xs text-rose-400">
          {(action.error as Error).message}
        </div>
      )}

      <LogsModal
        serviceName={service.name}
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
      />

      <ConfirmDialog
        open={!!pending}
        options={
          pending
            ? {
                title: `${pending[0].toUpperCase()}${pending.slice(1)} ${service.name}?`,
                message:
                  pending === 'down'
                    ? `This stops ${service.name}. It won't restart until you bring it back up.`
                    : `Are you sure you want to ${pending} ${service.name}?`,
                confirmLabel: `${pending[0].toUpperCase()}${pending.slice(1)}`,
                tone: actionTone[pending],
              }
            : null
        }
        onConfirm={() => {
          if (pending) action.mutate(pending);
          setPending(null);
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
