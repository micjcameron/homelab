import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) nav('/services', { replace: true });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      nav('/services', { replace: true });
    } catch (err: any) {
      setError(err?.status === 429 ? 'Too many attempts — wait a bit.' : 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl"
      >
        <h1 className="mb-1 text-2xl font-semibold text-white">Homelab Admin</h1>
        <p className="mb-6 text-sm text-slate-400">Sign in to manage your Pi.</p>
        <label className="mb-1 block text-sm text-slate-300">Username</label>
        <input
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
        />
        <label className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-sky-500"
        />
        {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-sky-600 py-2 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
