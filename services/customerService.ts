import { getAxiosInstance } from '@/lib/axios';
import { Customer, CustomerResponse } from '@/types/customer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { invoiceService } from './invoiceService';
import localDB from './localDatabase';

// Guards to prevent sync storms
let _isBackgroundSyncing = false;
let _backgroundSyncDisabled = false;
let _backgroundSyncDisabledLogged = false;

// Cooldown mechanism to reduce debug noise and unnecessary checks
let _lastBackgroundSyncAt: number | null = null;
const SYNC_COOLDOWN_MS = 30_000; // 30 seconds – adjust if needed

// Helper to check network connectivity
async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? false;
  } catch {
    return false;
  }
}

// Convert API Customer → Local DB row
function customerToLocalRow(customer: Customer): any {
  const serverId = customer.customer_id || customer.id;

  return {
    serverId: serverId.toString(),
    name: customer.name,
    contact: customer.contact,
    email: customer.email,
    taxNumber: customer.tax_number,
    openingBalance: customer.balance,
    address: customer.billing_address,
    city: customer.billing_city,
    state: customer.billing_state,
    country: customer.billing_country,
    zip: customer.billing_zip,
    synced: 1,
  };
}

// Convert Local DB row → API Customer format
function localRowToCustomer(row: any): Customer {
  const customerId = row.serverId ? parseInt(row.serverId) : 0;

  return {
    id: customerId,
    customer_id: customerId,
    chart_of_accounts_id: 0,
    chart_of_accounts_name: '',
    warehouse_id: 0,
    warehouse_name: '',
    name: row.name || '',
    type: 'Customer',
    email: row.email || '',
    tax_number: row.taxNumber,
    contact: row.contact || '',
    avatar: '',
    created_by: 0,
    is_active: 1,
    email_verified_at: null,
    billing_name: row.name || '',
    billing_country: row.country || '',
    billing_state: row.state,
    billing_city: row.city || '',
    billing_phone: row.contact || '',
    billing_zip: row.zip,
    billing_address: row.address || '',
    shipping_name: null,
    shipping_country: null,
    shipping_state: null,
    shipping_city: null,
    shipping_phone: null,
    shipping_zip: null,
    shipping_address: null,
    lang: 'en',
    balance: row.openingBalance || '0',
    created_at: row.createdAt || new Date().toISOString(),
    updated_at: row.updatedAt || new Date().toISOString(),
  };
}

export const customerService = {
  disableBackgroundSync() {
    _backgroundSyncDisabled = true;
    if (!__DEV__) return;
    if (!_backgroundSyncDisabledLogged) {
      console.debug('[customerService] Background syncs disabled (user logged out)');
      _backgroundSyncDisabledLogged = true;
    }
  },

  enableBackgroundSync() {
    _backgroundSyncDisabled = false;
    _backgroundSyncDisabledLogged = false;
  },

  /**
   * Fetch all customers – OFFLINE FIRST
   */
  async getAllCustomers(): Promise<Customer[]> {
    try {
      // 1. Return local data immediately
      const localCustomers = await localDB.getCustomers();

      // 2. Check network status
      const online = await isOnline();

      if (online) {
        if (_backgroundSyncDisabled) {
          // Background syncs are disabled — skip triggering a background fetch.
        } else {
          const token = await AsyncStorage.getItem('token');
          if (!token) {
            if (__DEV__) {
              console.debug('[customerService] No auth token present yet, skipping background customer fetch');
            }
          } else {
            // Cooldown + concurrency guard
            const shouldTriggerSync =
              !_isBackgroundSyncing &&
              (!_lastBackgroundSyncAt || Date.now() - _lastBackgroundSyncAt > SYNC_COOLDOWN_MS);

            if (shouldTriggerSync) {
              this.syncCustomersFromAPI()
                .catch(err => {
                  console.warn('[customerService] Background sync failed:', err.message);
                })
                .finally(() => {
                  _lastBackgroundSyncAt = Date.now();
                });
            }
            // No debug log here anymore – silence the repeated "skipped" messages
          }
        }
      }

      // Return cached data if available
      if (localCustomers.length > 0) {
        return localCustomers.map(localRowToCustomer);
      }

      // Fallback: fetch fresh data only if nothing cached and online
      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.get<CustomerResponse>('/customers');

          if (response.data.is_success && Array.isArray(response.data.data)) {
            const apiCustomers = response.data.data;

            for (const customer of apiCustomers) {
              await localDB.upsertCustomer(customerToLocalRow(customer));
            }

            return apiCustomers;
          }
        } catch (error: any) {
          console.warn('[customerService] Initial API fetch failed:', error.message);
        }
      }

      return [];
    } catch (error: any) {
      console.error('[customerService] Error in getAllCustomers:', error);
      throw new Error(error.message || 'Failed to fetch customers');
    }
  },

  /**
   * Background sync from API (full list)
   */
  async syncCustomersFromAPI(): Promise<void> {
    if (_isBackgroundSyncing) return;
    if (_backgroundSyncDisabled) return;

    _isBackgroundSyncing = true;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const axios = getAxiosInstance();
      const response = await axios.get<CustomerResponse>('/customers');

      if (response.data.is_success && Array.isArray(response.data.data)) {
        const apiCustomers = response.data.data;
        console.log(`[customerService] Syncing ${apiCustomers.length} customers from API`);

        for (const customer of apiCustomers) {
          await localDB.upsertCustomer(customerToLocalRow(customer));
        }

        console.log('[customerService] Customers synced successfully');
      }
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) {
        console.warn('[customerService] Background sync unauthorized (401)');
        return;
      }
      console.error('[customerService] Error syncing customers from API:', error);
      throw error;
    } finally {
      _isBackgroundSyncing = false;
    }
  },

  /**
   * Fetch single customer – OFFLINE FIRST
   */
  async getCustomerById(id: number): Promise<any> {
    try {
      const localCustomer = await localDB.getCustomerById(id.toString());

      if (localCustomer) {
        const result = {
          customer: localRowToCustomer(localCustomer),
          account_balance: { balance: localCustomer.openingBalance || '0' },
          custom_fields: []
        };

        const online = await isOnline();
        if (online) {
          this.syncCustomerFromAPI(id).catch(err => {
            console.warn('[customerService] Background single customer sync failed:', err.message);
          });
        }

        return result;
      }

      const online = await isOnline();
      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.get<any>(`/customers/${id}/edit`);

          if (response.data.is_success) {
            await localDB.upsertCustomer(customerToLocalRow(response.data.data.customer));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API fetch single customer failed:', error.message);
        }
      }

      throw new Error('Customer not found');
    } catch (error: any) {
      console.error('[customerService] Error fetching customer:', error);
      throw new Error(error.message || 'Failed to fetch customer');
    }
  },

  async syncCustomerFromAPI(id: number): Promise<void> {
    try {
      const axios = getAxiosInstance();
      const response = await axios.get<any>(`/customers/${id}/edit`);

      if (response.data.is_success) {
        await localDB.upsertCustomer(customerToLocalRow(response.data.data.customer));
        console.log(`[customerService] Customer ${id} synced successfully`);
      }
    } catch (error: any) {
      console.error('[customerService] Error syncing single customer:', error);
      throw error;
    }
  },

  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    try {
      const online = await isOnline();

      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.post<{ is_success: boolean; message: string; data: Customer }>('/customers/store', customerData);

          if (response.data.is_success) {
            // await localDB.upsertCustomer(customerToLocalRow(response.data.data));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API create failed, falling back to local:', error.message);
        }
      }

      const localRow = await localDB.addCustomer({
        name: customerData.name || '',
        contact: customerData.contact || '',
        email: customerData.email || '',
        taxNumber: customerData.tax_number || null,
        openingBalance: customerData.balance || '0',
        address: customerData.billing_address || '',
        city: customerData.billing_city || '',
        state: customerData.billing_state || '',
        country: customerData.billing_country || '',
        zip: customerData.billing_zip || '',
        synced: 0,
      });

      return localRowToCustomer(localRow);
    } catch (error: any) {
      console.error('[customerService] Error creating customer:', error);
      throw new Error(error.message || 'Failed to create customer');
    }
  },

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer> {
    try {
      const online = await isOnline();

      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.post<{ is_success: boolean; message: string; data: Customer }>(`/customers/${id}/update`, customerData);

          if (response.data.is_success) {
            await localDB.upsertCustomer(customerToLocalRow(response.data.data));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API update failed, falling back to local:', error.message);
        }
      }

      const localCustomer = await localDB.getCustomerById(id.toString());
      if (!localCustomer) throw new Error('Customer not found in local database');

      await localDB.updateCustomer(localCustomer.id, {
        name: customerData.name || localCustomer.name,
        contact: customerData.contact || localCustomer.contact,
        email: customerData.email || localCustomer.email,
        taxNumber: customerData.tax_number || localCustomer.taxNumber,
        openingBalance: customerData.balance || localCustomer.openingBalance,
        address: customerData.billing_address || localCustomer.address,
        city: customerData.billing_city || localCustomer.city,
        state: customerData.billing_state || localCustomer.state,
        country: customerData.billing_country || localCustomer.country,
        zip: customerData.billing_zip || localCustomer.zip,
        synced: 0,
      });

      const updated = await localDB.getCustomerById(localCustomer.id);
      return localRowToCustomer(updated!);
    } catch (error: any) {
      console.error('[customerService] Error updating customer:', error);
      throw new Error(error.message || 'Failed to update customer');
    }
  },

  async deleteCustomer(id: number): Promise<void> {
    try {
      const online = await isOnline();

      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.delete<{ is_success: boolean; message: string }>(`/customer/${id}/destroy`);

          if (response.data.is_success) {
            const localCustomer = await localDB.getCustomerById(id.toString());
            if (localCustomer) await localDB.deleteCustomer(localCustomer.id);
            return;
          }
        } catch (error: any) {
          console.warn('[customerService] API delete failed, deleting locally:', error.message);
        }
      }

      const localCustomer = await localDB.getCustomerById(id.toString());
      if (localCustomer) await localDB.deleteCustomer(localCustomer.id);
    } catch (error: any) {
      console.error('[customerService] Error deleting customer:', error);
      throw new Error(error.message || 'Failed to delete customer');
    }
  },

  async getUnsyncedCount(): Promise<number> {
    try {
      const unsynced = await localDB.getUnsynced();
      return unsynced.length;
    } catch (error) {
      console.error('[customerService] Error getting unsynced count:', error);
      return 0;
    }
  },

  async syncUnsyncedCustomers(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      const online = await isOnline();
      if (!online) return { success: false, syncedCount: 0, error: 'No internet connection' };

      const unsynced = await localDB.getUnsynced();
      if (unsynced.length === 0) return { success: true, syncedCount: 0 };

      const axios = getAxiosInstance();
      let syncedCount = 0;

      for (const row of unsynced) {
        try {
          const payload = {
            name: row.name,
            contact: row.contact,
            email: row.email,
            tax_number: row.taxNumber,
            balance: row.openingBalance,
            billing_name: row.name,
            billing_address: row.address,
            billing_city: row.city,
            billing_state: row.state,
            billing_country: row.country,
            billing_zip: row.zip,
            type: 'Customer',
            lang: 'en',
          };

          const response = await axios.post('/customers/store', payload);
          const created = response?.data?.data;
          const serverId = created?.id ?? created?.customer_id;

          if (serverId) {
            await localDB.markAsSynced(row.id, String(serverId));
            await localDB.updateInvoicesCustomerId(row.id, String(serverId));
            syncedCount++;
            console.log(`[customerService] Customer synced: ${row.name} (local ${row.id} → server ${serverId})`);
          }
        } catch (error) {
          console.warn('[customerService] Failed to sync customer:', row.id, error);
        }
      }

      if (syncedCount > 0) {
        try {
          await invoiceService.syncInvoices();
        } catch (error) {
          console.warn('[customerService] Failed to sync related invoices:', error);
        }
      }

      return { success: true, syncedCount };
    } catch (error: any) {
      console.error('[customerService] Error syncing unsynced customers:', error);
      return { success: false, syncedCount: 0, error: error.message };
    }
  },
};