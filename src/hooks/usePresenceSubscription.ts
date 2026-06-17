import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EmployeePresence } from '@/types/presence';

export function usePresenceSubscription(token: string) {
  const [presenceList, setPresenceList] = useState<EmployeePresence[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());
  const listRef = useRef<EmployeePresence[]>([]);

  // Local ref to prevent stale closures in realtime callbacks
  useEffect(() => {
    listRef.current = presenceList;
  }, [presenceList]);

  // Fetch all presence data initially from our Next.js admin API
  const fetchInitialData = useCallback(async () => {
    try {
      // Load from cache first for instant initial render
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('presence-cache');
        if (cached) {
          const { timestamp, data } = JSON.parse(cached);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setPresenceList(data || []);
            setLoading(false);
          }
        }
      }

      const res = await fetch('/api/presence/admin/live', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to load live presence data: ${res.statusText}`);
      }
      const data = await res.json();
      setPresenceList(data || []);
      setError(null);

      // Save to cache
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('presence-cache', JSON.stringify({
          timestamp: Date.now(),
          data
        }));
      }
    } catch (err) {
      console.error('[usePresenceSubscription] Fetch error:', err);
      // Only set error if we don't have cached data to show
      if (listRef.current.length === 0) {
        const message = err instanceof Error ? err.message : 'Failed to load presence list';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Subscribe to realtime updates
  useEffect(() => {
    setConnectionStatus('connecting');
    const supabase = supabaseRef.current;

    const channel = supabase
      .channel('presence-changes-live')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'employee_presence'
        },
        async (payload) => {
          const updatedRow = payload.new as {
            employee_id: string;
            status: 'working' | 'idle' | 'break' | 'offline';
            last_activity: string;
            last_heartbeat: string;
            break_started_at: string | null;
            updated_at: string;
          };
          
          // Check if we already have the employee details in the list
          const existing = listRef.current.find(p => p.employee_id === updatedRow.employee_id);
          
          if (existing) {
            // Merge details
            const merged: EmployeePresence = {
              ...existing,
              status: updatedRow.status,
              last_activity: updatedRow.last_activity,
              last_heartbeat: updatedRow.last_heartbeat,
              break_started_at: updatedRow.break_started_at,
              updated_at: updatedRow.updated_at
            };
            setPresenceList(prev => prev.map(p => p.employee_id === updatedRow.employee_id ? merged : p));
          } else {
            // If it is a new employee joining, fetch their employee info or refresh the list
            // We fetch the updated list to keep it accurate
            const res = await fetch('/api/presence/admin/live', {
              headers: { 'Authorization': `Bearer ${token}` }
            }).catch(() => null);
            if (res && res.ok) {
              const data = await res.json();
              setPresenceList(data || []);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'employee_presence'
        },
        (payload) => {
          const oldRow = payload.old as { employee_id?: string };
          // Remove from list immediately
          setPresenceList(prev => prev.filter(p => p.employee_id !== oldRow.employee_id));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    // Cleanup subscription
    return () => {
      supabase.removeChannel(channel);
    };
  }, [token]);

  return {
    presenceList,
    connectionStatus,
    loading,
    error,
    refresh: fetchInitialData
  };
}
