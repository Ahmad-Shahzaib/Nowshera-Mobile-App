import useNetwork from '@/hooks/useNetwork';
import localDB, { CustomerRow } from '@/services/localDatabase';
import { syncUnsynced } from '@/services/syncService';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type SyncContextValue = {
  ready: boolean;
  customers: CustomerRow[];
  unsyncedCount: number;
  addCustomer: (payload: Partial<CustomerRow>) => Promise<CustomerRow>;
  refresh: () => Promise<void>;
  syncNow: (apiUrl?: string) => Promise<{ success: boolean; syncedCount: number; error?: string }>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export const useSync = () => {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
};

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const { isConnected } = useNetwork();

  const refresh = useCallback(async () => {
    const rows = await localDB.getCustomers();
    setCustomers(rows);
    const unsynced = await localDB.getUnsynced();
    setUnsyncedCount(unsynced.length);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await localDB.initDB();
      if (!mounted) return;
      await refresh();
      setReady(true);
    })();
    return () => { mounted = false; };
  }, [refresh]);

  useEffect(() => {
    // when connection becomes true, attempt background sync
    if (isConnected) {
      // fire and forget
      (async () => {
        await syncNow();
      })();
    }
  }, [isConnected]);

  const addCustomer = useCallback(async (payload: Partial<CustomerRow>) => {
    const row = await localDB.addCustomer(payload);
    await refresh();
    return row;
  }, [refresh]);

  const syncNow = useCallback(async (apiUrl?: string) => {
    const res = await syncUnsynced(apiUrl);
    // refresh local list and unsynced count
    await refresh();
    return res;
  }, [refresh]);

  const value = useMemo(() => ({ ready, customers, unsyncedCount, addCustomer, refresh, syncNow }), [ready, customers, unsyncedCount, addCustomer, refresh, syncNow]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export default SyncContext;
