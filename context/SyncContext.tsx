import useNetwork from '@/hooks/useNetwork';
import { bankAccountService } from '@/services/bankAccountService';
import { dealerService } from '@/services/dealerService';
import localDB, { CustomerRow } from '@/services/localDatabase';
import { categoryService, productService } from '@/services/productService';
import { syncAll, syncUnsynced } from '@/services/syncService';
import { warehouseService } from '@/services/warehouseService';
import type { Dealer } from '@/types/dealer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type SyncContextValue = {
  ready: boolean;
  customers: CustomerRow[];
  dealers: Dealer[];
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  isOnline: boolean;
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
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const { isConnected } = useNetwork();

  const refresh = useCallback(async () => {
    const rows = await localDB.getCustomers();
    setCustomers(rows);
    const dealersData = await localDB.getDealers();
    setDealers(dealersData);
    // Count BOTH unsynced customers AND unsynced invoices for auto-sync trigger
    const unsynced = await localDB.getUnsynced();
    const unsyncedInvoices = await localDB.getUnsyncedInvoices();
    const totalUnsynced = unsynced.length + unsyncedInvoices.length;
    console.log(`[SyncContext] Unsynced count: ${unsynced.length} customers + ${unsyncedInvoices.length} invoices = ${totalUnsynced} total`);
    setUnsyncedCount(totalUnsynced);
  }, []);

  useEffect(() => {
    let mounted = true;
    // Disable verbose DB logging to reduce console noise
    // Uncomment the line below only for debugging database issues
    // try { enableDbLogging(true); } catch (e) { /* ignore */ }

    (async () => {
      try {
        // Ensure DB tables exist so local reads work, but avoid kicking off
        // heavy remote syncs until the user has signed in.
        await localDB.initDB();

        // If user is not signed in yet, skip remote syncs that write heavily
        // to the DB (products, categories, warehouses, dealers, bank accounts).
        const signed = await AsyncStorage.getItem('SIGNED_IN');
        if (signed !== 'true') {
          if (!mounted) return;
          await refresh();
          setReady(true);
          return;
        }

        if (!mounted) return;

        // At this point user is signed in — proceed with normal background syncs
        try {
          const needsSync = await productService.needsSync();
          if (needsSync && isConnected) {
            console.log('[SyncContext] Syncing products from server...');
            const result = await productService.syncProducts();
            if (result.success) {
              console.log(`[SyncContext] Successfully synced ${result.count} products`);
            } else {
              console.warn('[SyncContext] Failed to sync products, will use cached data if available:', result.error);
              const cachedCount = await productService.getProductCount();
              if (cachedCount > 0) {
                console.log(`[SyncContext] Using ${cachedCount} cached products`);
              } else {
                console.warn('[SyncContext] No cached products available. Product search may not work until sync succeeds.');
              }
            }
          } else {
            const count = await productService.getProductCount();
            console.log(`[SyncContext] Products already synced (${count} products in database)`);
          }
        } catch (error) {
          console.warn('[SyncContext] Error syncing products (non-critical):', error);
          const count = await productService.getProductCount();
          if (count > 0) {
            console.log(`[SyncContext] Using ${count} cached products`);
          }
        }

        // Sync categories if needed
        try {
          const needsCategorySync = await categoryService.needsSync();
          if (needsCategorySync && isConnected) {
            console.log('[SyncContext] Syncing categories from server...');
            const result = await categoryService.syncCategories();
            if (result.success) {
              console.log(`[SyncContext] Successfully synced ${result.count} categories`);
            } else {
              console.warn('[SyncContext] Failed to sync categories:', result.error);
              const cachedCount = await categoryService.getCategoryCount();
              if (cachedCount > 0) {
                console.log(`[SyncContext] Using ${cachedCount} cached categories`);
              }
            }
          } else {
            const count = await categoryService.getCategoryCount();
            console.log(`[SyncContext] Categories already synced (${count} categories in database)`);
          }
        } catch (error) {
          console.warn('[SyncContext] Error syncing categories (non-critical):', error);
        }

        // Sync warehouses if needed
        try {
          const lastWarehouseSync = await warehouseService.getLastSyncTime();
          const needsWarehouseSync = !lastWarehouseSync || (Date.now() - lastWarehouseSync > 24 * 60 * 60 * 1000);

          if (needsWarehouseSync && isConnected) {
            console.log('[SyncContext] Syncing warehouses from server...');
            const result = await warehouseService.syncWarehouses();
            if (result.success) {
              console.log(`[SyncContext] Successfully synced ${result.count} warehouses`);
            } else {
              console.warn('[SyncContext] Failed to sync warehouses:', result.error);
              const warehouses = await warehouseService.getLocalWarehouses();
              if (warehouses.length > 0) {
                console.log(`[SyncContext] Using ${warehouses.length} cached warehouses`);
              }
            }
          } else {
            const warehouses = await warehouseService.getLocalWarehouses();
            console.log(`[SyncContext] Warehouses already synced (${warehouses.length} warehouses in database)`);
          }
        } catch (error) {
          console.warn('[SyncContext] Error syncing warehouses (non-critical):', error);
        }

        // Sync dealers if needed
        try {
          const needsDealerSync = await dealerService.needsSync();

          if (needsDealerSync && isConnected) {
            console.log('[SyncContext] Syncing dealers from server...');
            const result = await dealerService.syncDealers();
            if (result.success) {
              console.log(`[SyncContext] Successfully synced ${result.count} dealers`);
            } else {
              console.warn('[SyncContext] Failed to sync dealers:', result.error);
              const dealersData = await dealerService.getLocalDealers();
              if (dealersData.length > 0) {
                console.log(`[SyncContext] Using ${dealersData.length} cached dealers`);
              }
            }
          } else {
            const dealersData = await dealerService.getLocalDealers();
            console.log(`[SyncContext] Dealers already synced (${dealersData.length} dealers in database)`);
          }
        } catch (error) {
          console.warn('[SyncContext] Error syncing dealers (non-critical):', error);
        }

        // Sync bank accounts if needed
        try {
          const needsBankSync = await bankAccountService.needsSync();

          if (needsBankSync && isConnected) {
            console.log('[SyncContext] Syncing bank accounts from server...');
            const result = await bankAccountService.syncBankAccounts();
            if (result.success) {
              console.log(`[SyncContext] Successfully synced ${result.count} bank accounts`);
            } else {
              console.warn('[SyncContext] Failed to sync bank accounts:', result.error);
              const count = await bankAccountService.getBankAccountCount();
              if (count > 0) {
                console.log(`[SyncContext] Using ${count} cached bank accounts`);
              }
            }
          } else {
            const count = await bankAccountService.getBankAccountCount();
            console.log(`[SyncContext] Bank accounts already synced (${count} bank accounts in database)`);
          }
        } catch (error) {
          console.warn('[SyncContext] Error syncing bank accounts (non-critical):', error);
        }

        await refresh();
        setReady(true);
      } catch (err) {
        console.warn('[SyncContext] Initialization error (non-fatal):', err);
        try { await refresh(); } catch (e) { /* ignore */ }
        setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [refresh, isConnected]);

  const syncNow = useCallback(async (apiUrl?: string) => {
    if (isSyncing) {
      console.log('[SyncContext] Sync already in progress, skipping');
      return { success: false, syncedCount: 0, error: 'Sync already in progress' };
    }

    setIsSyncing(true);
    try {
      console.log('[SyncContext] ========================================');
      console.log('[SyncContext] Starting full sync...');
      console.log('[SyncContext] PHASE 1: Upload local data to server');
      console.log('[SyncContext]   → Customers will be synced FIRST');
      console.log('[SyncContext]   → Then invoices will be synced');
      console.log('[SyncContext] ========================================');
      
      // Step 1: Upload unsynced local data to server
      // CRITICAL: syncAll() ensures customers are synced before invoices
      const res = apiUrl ? await syncUnsynced(apiUrl) : await syncAll();
      console.log(`[SyncContext] ✓ PHASE 1 complete - ${res.syncedCount} items uploaded to server`);
      if (res.error) {
        console.warn('[SyncContext] Some items had issues:', res.error);
      }
      
      // Step 2: Download fresh data from server (force refresh all)
      console.log('[SyncContext] ========================================');
      console.log('[SyncContext] PHASE 2: Download fresh data from server');
      console.log('[SyncContext] ========================================');
      
      // Sync products
      try {
        const productResult = await productService.syncProducts();
        if (productResult.success) {
          console.log(`[SyncContext] Synced ${productResult.count} products`);
        } else {
          console.warn('[SyncContext] Failed to sync products:', productResult.error);
        }
      } catch (error) {
        console.warn('[SyncContext] Error syncing products:', error);
      }
      
      // Sync categories
      try {
        const categoryResult = await categoryService.syncCategories();
        if (categoryResult.success) {
          console.log(`[SyncContext] Synced ${categoryResult.count} categories`);
        } else {
          console.warn('[SyncContext] Failed to sync categories:', categoryResult.error);
        }
      } catch (error) {
        console.warn('[SyncContext] Error syncing categories:', error);
      }
      
      // Sync warehouses
      try {
        const warehouseResult = await warehouseService.syncWarehouses();
        if (warehouseResult.success) {
          console.log(`[SyncContext] Synced ${warehouseResult.count} warehouses`);
        } else {
          console.warn('[SyncContext] Failed to sync warehouses:', warehouseResult.error);
        }
      } catch (error) {
        console.warn('[SyncContext] Error syncing warehouses:', error);
      }
      
      // Sync dealers
      try {
        const dealerResult = await dealerService.syncDealers();
        if (dealerResult.success) {
          console.log(`[SyncContext] Synced ${dealerResult.count} dealers`);
        } else {
          console.warn('[SyncContext] Failed to sync dealers:', dealerResult.error);
        }
      } catch (error) {
        console.warn('[SyncContext] Error syncing dealers:', error);
      }
      
      // Sync bank accounts
      try {
        const bankResult = await bankAccountService.syncBankAccounts();
        if (bankResult.success) {
          console.log(`[SyncContext] Synced ${bankResult.count} bank accounts`);
        } else {
          console.warn('[SyncContext] Failed to sync bank accounts:', bankResult.error);
        }
      } catch (error) {
        console.warn('[SyncContext] Error syncing bank accounts:', error);
      }
      
      console.log('[SyncContext] Full sync complete!');
      
      // Refresh local state
      await refresh();
      setLastSyncTime(new Date());
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [refresh, isSyncing]);

  useEffect(() => {
    // when connection becomes true, attempt background sync
    if (isConnected && unsyncedCount > 0 && !isSyncing) {
      console.log(`[SyncContext] Connection restored, auto-syncing ${unsyncedCount} unsynced items...`);
      console.log('[SyncContext] Note: Customers will be synced before their invoices');
      // fire and forget
      (async () => {
        await syncNow();
      })();
    }
  }, [isConnected, unsyncedCount, isSyncing]);

  const addCustomer = useCallback(async (payload: Partial<CustomerRow>) => {
    const row = await localDB.addCustomer(payload);
    await refresh();
    return row;
  }, [refresh]);

  const value = useMemo(() => ({ 
    ready, 
    customers, 
    dealers,
    unsyncedCount, 
    isSyncing,
    lastSyncTime,
    isOnline: isConnected ?? false,
    addCustomer, 
    refresh, 
    syncNow 
  }), [ready, customers, dealers, unsyncedCount, isSyncing, lastSyncTime, isConnected, addCustomer, refresh, syncNow]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export default SyncContext;

