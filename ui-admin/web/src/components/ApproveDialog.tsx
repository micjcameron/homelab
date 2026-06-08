import { useEffect, useState } from 'react';

export function ApproveDialog({
  open,
  deviceLabel,
  suggested,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  deviceLabel: string;
  suggested: string;
  onConfirm: (preferredName: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(suggested);
  }, [open, suggested]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(name.trim());
        }}
      >
        <h2 className="text-lg font-semibold text-white">Approve device</h2>
        <p className="mt-1 text-sm text-slate-400">{deviceLabel}</p>
        <label className="mt-4 mb-1 block text-sm text-slate-300">
          Preferred name <span className="text-slate-500">(optional)</span>
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Living Room TV"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Approve
          </button>
        </div>
      </form>
    </div>
  );
}
