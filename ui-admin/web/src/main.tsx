import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider, useAuth } from './auth';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ServicesPage } from './pages/ServicesPage';
import { NetworkPage } from './pages/NetworkPage';
import { ProxiesPage } from './pages/ProxiesPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Guarded() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <Guarded />,
    children: [
      { index: true, element: <Navigate to="/services" replace /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'network', element: <NetworkPage /> },
      { path: 'proxies', element: <ProxiesPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
