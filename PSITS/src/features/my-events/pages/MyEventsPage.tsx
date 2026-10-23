import { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/shared/layouts';
import { Card, Badge, Button } from '@/shared/components/Form';
import api from '@/shared/services/api';
import { Calendar, RefreshCw } from 'lucide-react';

export const MyEventsPage = () => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.getMyEventRegistrations();
      if (data?.success) setRegistrations(data.registrations || []);
    } catch {
      // keep page usable
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statusVariant = (status: string): 'primary' | 'success' | 'warning' | 'error' | 'info' => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'error';
    if (s === 'pending') return 'warning';
    return 'info';
  };

  const hasRows = useMemo(() => registrations.length > 0, [registrations]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">My Events</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm">Track the events you joined and your approval status.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} isLoading={isLoading} className="w-full sm:w-auto">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        {!hasRows && (
          <Card className="p-8 text-center text-slate-500 dark:text-slate-400">
            {isLoading ? 'Loading your event registrations...' : 'You have not joined any event yet.'}
          </Card>
        )}

        {hasRows && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {registrations.map((registration) => (
              <Card key={registration.id} className="p-5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{registration.eventTitle || 'Event'}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      <Calendar size={14} className="inline mr-1 text-primary" />
                      Registered: {registration.createdAt ? String(registration.createdAt).slice(0, 10) : '-'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(registration.status)}>
                    {String(registration.status || 'pending').charAt(0).toUpperCase() + String(registration.status || 'pending').slice(1)}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <p>Participants: {registration.participantCount || 1}</p>
                  {registration.rejectionReason && (
                    <p className="text-rose-600 dark:text-rose-400 font-medium">Reason: {registration.rejectionReason}</p>
                  )}
                </div>

              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};
