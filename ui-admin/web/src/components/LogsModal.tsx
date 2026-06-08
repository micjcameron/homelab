import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

const TAIL_OPTIONS = [100, 200, 500, 1000];

export function LogsModal({
  serviceName,
  open,
  onClose,
}: {
  serviceName: string;
  open: boolean;
  onClose: () => void;
}) {
  const [tail, setTail] = useState(200);
  const [wrap, setWrap] = useState(true);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const logs = useQuery({
    queryKey: ['logs', serviceName, tail],
    queryFn: () => api.serviceLogs(serviceName, tail),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-base font-semibold text-white">{serviceName}</h2>
            <span className="text-xs text-slate-500">logs</span>
            {logs.data && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                {logs.data.source}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-400">tail</label>
            <select
              value={tail}
              onChange={(e) => setTail(Number(e.target.value))}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
            >
              {TAIL_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              onClick={() => setWrap((w) => !w)}
              className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              {wrap ? 'No wrap' : 'Wrap'}
            </button>
            <button
              onClick={() => logs.refetch()}
              className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="rounded border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto bg-black/60">
          <pre
            className={`p-4 text-[12px] leading-relaxed text-slate-300 ${
              wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
          >
            {logs.isLoading
              ? 'loading…'
              : logs.data?.logs?.trim()
                ? logs.data.logs
                : `(no logs${
                    logs.data?.source === 'none'
                      ? ''
                      : ` — source: ${logs.data?.source}`
                  })`}
          </pre>
        </div>
      </div>
    </div>
  );
}
