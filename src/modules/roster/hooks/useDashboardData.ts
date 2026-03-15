import { useState, useEffect, useCallback } from 'react';

export interface DashboardData {
  users: any[];
  shiftTypes: any[];
  shifts: any[];
  auditLogs: any[];
  myTasks: any[];
  shiftSwaps: any[];
  notifications: any[];
  loading: boolean;
  error: string | null;
}

export function useDashboardData(userId: string | null) {
  const [data, setData] = useState<DashboardData>({
    users: [],
    shiftTypes: [],
    shifts: [],
    auditLogs: [],
    myTasks: [],
    shiftSwaps: [],
    notifications: [],
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    if (!userId) return;

    try {
      const headers = { 'x-user-id': userId };
      
      const [
        usersRes,
        typesRes,
        shiftsRes,
        auditRes,
        tasksRes,
        swapsRes,
        notifRes
      ] = await Promise.all([
        fetch('/api/users', { headers }),
        fetch('/api/shift-types', { headers }),
        fetch('/api/shifts', { headers }),
        fetch('/api/audit-logs', { headers }),
        fetch('/api/my-tasks', { headers }),
        fetch('/api/shift-swaps', { headers }),
        fetch('/api/notifications', { headers })
      ]);

      const [
        users,
        shiftTypes,
        shifts,
        auditLogs,
        myTasks,
        shiftSwaps,
        notifications
      ] = await Promise.all([
        usersRes.json(),
        typesRes.json(),
        shiftsRes.json(),
        auditRes.json(),
        tasksRes.json(),
        swapsRes.json(),
        notifRes.json()
      ]);

      setData({
        users,
        shiftTypes,
        shifts,
        auditLogs,
        myTasks,
        shiftSwaps,
        notifications,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setData(prev => ({ ...prev, loading: false, error: 'Failed to load dashboard data' }));
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
    // Poll every 30 seconds for real-time updates (fallback until Supabase Realtime)
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { ...data, refresh: fetchData };
}
