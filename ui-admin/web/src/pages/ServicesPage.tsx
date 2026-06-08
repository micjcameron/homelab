import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { ServiceCard } from '../components/ServiceCard';

export function ServicesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
    refetchInterval: 10_000,
  });

  if (isLoading)
    return <div className="text-slate-400">Loading services…</div>;
  if (error)
    return <div className="text-rose-400">Failed to load services.</div>;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {data?.map((s) => <ServiceCard key={s.name} service={s} />)}
    </div>
  );
}
