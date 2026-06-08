import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { SystemBanner } from './SystemBanner';

const tabs = [
  { to: '/home-assistant', label: 'Home Assistant' },
  { to: '/network', label: 'Network' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 pb-12">
      <header className="flex items-center justify-between py-5">
        <h1 className="text-lg font-semibold text-white">
          🏠 Homelab <span className="text-slate-500">admin</span>
        </h1>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span>{user?.username}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-700 px-3 py-1 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="mb-5 flex gap-1 border-b border-slate-800">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `border-b-2 px-4 py-2 text-sm font-medium ${
                isActive
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <SystemBanner />
      <main className="mt-5">{children}</main>
    </div>
  );
}
