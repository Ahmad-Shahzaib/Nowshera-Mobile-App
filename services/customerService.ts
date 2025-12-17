import { getAxiosInstance } from '@/lib/axios';
import { Customer, CustomerResponse } from '@/types/customer';
import * as Network from 'expo-network';
import { invoiceService } from './invoiceService';
import localDB from './localDatabase';

// Helper to check network connectivity
async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? false;
  } catch {
    return false;
  }
}

// Helper to convert API Customer to LocalDB CustomerRow
function customerToLocalRow(customer: Customer): any {
  // Use customer_id if available, otherwise fall back to id
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

// Helper to convert LocalDB CustomerRow to API Customer format
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
  /**
   * Fetch all customers - OFFLINE FIRST
   * 1. Return local data immediately if available
   * 2. If online, fetch from API and sync to local DB in background
   */
  async getAllCustomers(): Promise<Customer[]> {
    try {
      // Always get local data first
      const localCustomers = await localDB.getCustomers();
      
      // Check if online
      const online = await isOnline();
      
      if (online) {
        // Sync in background (don't wait for it)
        this.syncCustomersFromAPI().catch(error => {
          console.warn('[customerService] Background sync failed:', error.message);
        });
      }
      
      // Return local data immediately (offline-first approach)
      // If local data exists, use it; otherwise return empty array
      if (localCustomers.length > 0) {
        return localCustomers.map(localRowToCustomer);
      }
      
      // If no local data and we're online, wait for API data
      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.get<CustomerResponse>('/customers');
          
          if (response.data.is_success && Array.isArray(response.data.data)) {
            const apiCustomers = response.data.data;
            
            // Save to local DB
            for (const customer of apiCustomers) {
              await localDB.upsertCustomer(customerToLocalRow(customer));
            }
            
            return apiCustomers;
          }
        } catch (error: any) {
          console.warn('[customerService] API fetch failed:', error.message);
        }
      }
      
      return [];
    } catch (error: any) {
      console.error('[customerService] Error in getAllCustomers:', error);
      throw new Error(error.message || 'Failed to fetch customers');
    }
  },

  /**
   * Background sync customers from API
   */
  async syncCustomersFromAPI(): Promise<void> {
    try {
      const axios = getAxiosInstance();
      const response = await axios.get<CustomerResponse>('/customers');
      
      if (response.data.is_success && Array.isArray(response.data.data)) {
        const apiCustomers = response.data.data;
        
        console.log(`[customerService] Syncing ${apiCustomers.length} customers from API`);
        
        // Update local DB with API data
        for (const customer of apiCustomers) {
          const customerRow = customerToLocalRow(customer);
          await localDB.upsertCustomer(customerRow);
        }
        
        console.log('[customerService] Customers synced successfully');
      }
    } catch (error: any) {
      console.error('[customerService] Error syncing customers from API:', error);
      throw error;
    }
  },

  /**
   * Fetch a single customer by ID - OFFLINE FIRST
   * First check local DB, then try API if online
   */
  async getCustomerById(id: number): Promise<any> {
    try {
      // First, try to get from local DB (offline-first)
      const localCustomer = await localDB.getCustomerById(id.toString());
      
      if (localCustomer) {
        const result = {
          customer: localRowToCustomer(localCustomer),
          account_balance: { balance: localCustomer.openingBalance || '0' },
          custom_fields: []
        };
        
        // If online, sync in background
        const online = await isOnline();
        if (online) {
          this.syncCustomerFromAPI(id).catch(error => {
            console.warn('[customerService] Background customer sync failed:', error.message);
          });
        }
        
        return result;
      }
      
      // If not in local DB and we're online, fetch from API
      const online = await isOnline();
      if (online) {
        try {
          const axios = getAxiosInstance();
          const response = await axios.get<{ 
            is_success: boolean; 
            message: string; 
            data: { 
              customer: Customer; 
              account_balance: any; 
              custom_fields: any[] 
            } 
          }>(`/customers/${id}/edit`);
          
          if (response.data.is_success) {
            // Save to local cache
            await localDB.upsertCustomer(customerToLocalRow(response.data.data.customer));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API fetch failed:', error.message);
        }
      }
      
      throw new Error('Customer not found');
    } catch (error: any) {
      console.error('[customerService] Error fetching customer:', error);
      throw new Error(error.message || 'Failed to fetch customer');
    }
  },

  /**
   * Background sync single customer from API
   */
  async syncCustomerFromAPI(id: number): Promise<void> {
    try {
      const axios = getAxiosInstance();
      const response = await axios.get<{ 
        is_success: boolean; 
        message: string; 
        data: { 
          customer: Customer; 
          account_balance: any; 
          custom_fields: any[] 
        } 
      }>(`/customers/${id}/edit`);
      
      if (response.data.is_success) {
        await localDB.upsertCustomer(customerToLocalRow(response.data.data.customer));
        console.log(`[customerService] Customer ${id} synced successfully`);
      }
    } catch (error: any) {
      console.error('[customerService] Error syncing customer from API:', error);
      throw error;
    }
  },

  /**
   * Create a new customer - OFFLINE FIRST
   */
  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    try {
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to create on server immediately
          const axios = getAxiosInstance();
          const response = await axios.post<{ is_success: boolean; message: string; data: Customer }>('/customers/store', customerData);
          
          if (response.data.is_success) {
            // Save to local DB with synced flag
            await localDB.upsertCustomer(customerToLocalRow(response.data.data));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API create failed, saving locally:', error.message);
        }
      }
      
      // Save locally as unsynced
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
        synced: 0, // Mark as unsynced
      });
      
      return localRowToCustomer(localRow);
    } catch (error: any) {
      console.error('[customerService] Error creating customer:', error);
      throw new Error(error.message || 'Failed to create customer');
    }
  },

  /**
   * Update an existing customer - OFFLINE FIRST
   */
  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer> {
    try {
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to update on server immediately
          const axios = getAxiosInstance();
          const response = await axios.post<{ is_success: boolean; message: string; data: Customer }>(`/customers/${id}/update`, customerData);
          
          if (response.data.is_success) {
            // Update local DB
            await localDB.upsertCustomer(customerToLocalRow(response.data.data));
            return response.data.data;
          }
        } catch (error: any) {
          console.warn('[customerService] API update failed, saving locally:', error.message);
        }
      }
      
      // Update locally and mark as unsynced
      const localCustomer = await localDB.getCustomerById(id.toString());
      if (localCustomer) {
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
          synced: 0, // Mark as unsynced
        });
        
        const updated = await localDB.getCustomerById(localCustomer.id);
        return localRowToCustomer(updated!);
      }
      
      throw new Error('Customer not found in local database');
    } catch (error: any) {
      console.error('[customerService] Error updating customer:', error);
      throw new Error(error.message || 'Failed to update customer');
    }
  },

  /**
   * Delete a customer - OFFLINE FIRST
   */
  async deleteCustomer(id: number): Promise<void> {
    try {
      const online = await isOnline();
      
      if (online) {
        try {
          // Try to delete from server immediately
          const axios = getAxiosInstance();
          const response = await axios.delete<{ is_success: boolean; message: string }>(`/customer/${id}/destroy`);
          
          if (response.data.is_success) {
            // Delete from local DB
            const localCustomer = await localDB.getCustomerById(id.toString());
            if (localCustomer) {
              await localDB.deleteCustomer(localCustomer.id);
            }
            return;
          }
        } catch (error: any) {
          console.warn('[customerService] API delete failed, deleting locally:', error.message);
        }
      }
      
      // Delete from local DB
      // Note: In a production app, you might want to mark as "pending deletion" 
      // instead of actually deleting, then sync deletion when online
      const localCustomer = await localDB.getCustomerById(id.toString());
      if (localCustomer) {
        await localDB.deleteCustomer(localCustomer.id);
      }
    } catch (error: any) {
      console.error('[customerService] Error deleting customer:', error);
      throw new Error(error.message || 'Failed to delete customer');
    }
  },

  /**
   * Get count of unsynced customers
   */
  async getUnsyncedCount(): Promise<number> {
    try {
      const unsynced = await localDB.getUnsynced();
      return unsynced.length;
    } catch (error) {
      console.error('[customerService] Error getting unsynced count:', error);
      return 0;
    }
  },

  /**
   * Sync unsynced customers to server
   */
  async syncUnsyncedCustomers(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      const online = await isOnline();
      if (!online) {
        return { success: false, syncedCount: 0, error: 'No internet connection' };
      }

      const unsynced = await localDB.getUnsynced();
      if (unsynced.length === 0) {
        return { success: true, syncedCount: 0 };
      }

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
            // Update local customer with server ID
            const oldLocalId = row.id;
            await localDB.markAsSynced(oldLocalId, String(serverId));
            
            // Update invoices that reference this local customer ID
            await localDB.updateInvoicesCustomerId(oldLocalId, String(serverId));
            
            syncedCount++;
            console.log(`[customerService] Customer synced: ${row.name}, local ID: ${oldLocalId}, server ID: ${serverId}`);
          }
        } catch (error) {
          console.warn('[customerService] Failed to sync customer:', row.id, error);
          // Continue with next customer
        }
      }

      // After syncing customers, try to sync their invoices
      if (syncedCount > 0) {
        try {
          console.log('[customerService] Syncing related invoices...');
          await invoiceService.syncInvoices();
        } catch (error) {
          console.warn('[customerService] Failed to sync invoices:', error);
        }
      }

      return { success: true, syncedCount };
    } catch (error: any) {
      console.error('[customerService] Error syncing customers:', error);
      return { success: false, syncedCount: 0, error: error.message };
    }
  },
};
