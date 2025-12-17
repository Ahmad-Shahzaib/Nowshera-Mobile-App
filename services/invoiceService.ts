import { getAxiosInstance } from '@/lib/axios';
import { Invoice, InvoiceApi, InvoiceApiResponse } from '@/types/invoice';
import * as Network from 'expo-network';
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

// Helper to convert API Invoice status number to string
function getStatusFromNumber(status: number): 'Paid' | 'Partially Paid' | 'Unpaid' {
  switch (status) {
    case 1:
      return 'Paid';
    case 2:
      return 'Partially Paid';
    case 3:
    default:
      return 'Unpaid';
  }
}

// Helper to convert API Invoice to LocalDB InvoiceRow
function invoiceToLocalRow(invoice: InvoiceApi): any {
  return {
    serverId: invoice.id.toString(),
    invoiceNo: `#INVO${String(invoice.invoice_id).padStart(5, '0')}`,
    customerId: invoice.customer_id.toString(),
    customerName: invoice.customer_name || invoice.customer?.name || 'Unknown Customer',
    warehouseId: invoice.warehouse_id.toString(),
    warehouseName: invoice.warehouse_name,
    issueDate: invoice.issue_date,
    dueDate: invoice.issue_date, // API doesn't provide due date, using issue date
    subTotal: invoice.sub_total.toString(),
    discountTotal: invoice.discount_total.toString(),
    taxTotal: invoice.tax_total.toString(),
    grandTotal: invoice.grand_total.toString(),
    dueAmount: invoice.due_amount.toString(),
    status: getStatusFromNumber(invoice.status),
    synced: 1,
  };
}

// Helper to convert LocalDB InvoiceRow to API Invoice format
function localRowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNo: row.invoiceNo,
    customerId: row.customerId,
    customerName: row.customerName,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    subTotal: row.subTotal,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    grandTotal: row.grandTotal,
    dueAmount: row.dueAmount,
    status: row.status,
    serverId: row.serverId,
    createdAt: row.createdAt || new Date().toISOString(),
    updatedAt: row.updatedAt || new Date().toISOString(),
    synced: row.synced || 0,
  };
}

export const invoiceService = {
  /**
   * Fetch invoices with pagination - OFFLINE FIRST
   * Online: Fetch from API with pagination
   * Offline: Return local unsynced invoices
   */
  async getInvoices(page: number = 1, perPage: number = 10): Promise<{ invoices: Invoice[]; total: number; currentPage: number; totalPages: number }> {
    try {
      // Check if online
      const online = await isOnline();
      console.log(`[invoiceService] Network status: ${online ? 'online' : 'offline'}`);
      
      if (online) {
        try {
          // Fetch from API with pagination
          const axios = getAxiosInstance();
          const response = await axios.get<InvoiceApiResponse>(`/invoices?page=${page}&per_page=${perPage}`);
          
          console.log('[invoiceService] API Response:', {
            status: response.data.status,
            hasInvoices: !!response.data.invoices,
            invoiceCount: response.data.invoices?.length || 0
          });
          
          if (response.data.status && response.data.invoices) {
            const apiInvoices = response.data.invoices;
            console.log(`[invoiceService] Fetched ${apiInvoices.length} invoices from API (page ${page})`);
            
            // Convert and return API data
            const invoices = apiInvoices.map(invoice => {
              const localRow = invoiceToLocalRow(invoice);
              return localRowToInvoice(localRow);
            });
            
            // Backend should provide pagination info, using defaults if not available
            const total = response.data.pagination?.total || apiInvoices.length;
            const totalPages = response.data.pagination?.last_page || Math.ceil(total / perPage);
            
            return {
              invoices,
              total,
              currentPage: page,
              totalPages
            };
          } else {
            console.log('[invoiceService] API returned no invoices or status false');
            return {
              invoices: [],
              total: 0,
              currentPage: page,
              totalPages: 0
            };
          }
        } catch (error) {
          console.error('[invoiceService] API fetch failed, showing unsynced local invoices:', error);
          // If API fails, fall through to offline mode
        }
      }
      
      // Offline mode: Return unsynced invoices only (sorted by creation date, newest first)
      console.log('[invoiceService] Offline mode - loading unsynced invoices');
      const unsyncedInvoices = await localDB.getUnsyncedInvoices();
      console.log(`[invoiceService] Found ${unsyncedInvoices.length} unsynced invoices`);
      
      // Sort by createdAt descending (newest first)
      const sortedInvoices = unsyncedInvoices.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      const invoices = sortedInvoices.map(localRowToInvoice);
      
      return {
        invoices,
        total: invoices.length,
        currentPage: 1,
        totalPages: 1
      };
    } catch (error) {
      console.error('[invoiceService] getInvoices error:', error);
      return {
        invoices: [],
        total: 0,
        currentPage: page,
        totalPages: 0
      };
    }
  },

  /**
   * Fetch all invoices - OFFLINE FIRST (legacy method for backward compatibility)
   * 1. Return local data immediately
   * 2. If online, fetch from API and sync to local DB
   */
  async getAllInvoices(): Promise<Invoice[]> {
    try {
      // Always try to get local data first
      const localInvoices = await localDB.getInvoices();
      console.log(`[invoiceService] Found ${localInvoices.length} invoices in local DB`);
      
      // Check if online
      const online = await isOnline();
      console.log(`[invoiceService] Network status: ${online ? 'online' : 'offline'}`);
      
      if (online) {
        try {
          // Fetch from API in background
          const axios = getAxiosInstance();
          const response = await axios.get<InvoiceApiResponse>('/invoices');
          
          console.log('[invoiceService] API Response:', {
            status: response.data.status,
            hasInvoices: !!response.data.invoices,
            invoiceCount: response.data.invoices?.length || 0
          });
          
          if (response.data.status && response.data.invoices && response.data.invoices.length > 0) {
            const apiInvoices = response.data.invoices;
            console.log(`[invoiceService] Fetched ${JSON.stringify(apiInvoices)} invoices from API`);
            
            // Clear and repopulate local DB with fresh data
            await localDB.clearAllInvoices();
            for (const invoice of apiInvoices) {
              try {
                const localRow = invoiceToLocalRow(invoice);
                console.log(`[invoiceService] Upserting invoice:`, localRow.invoiceNo);
                await localDB.upsertInvoice(localRow);
              } catch (err) {
                console.error(`[invoiceService] Failed to upsert invoice ${invoice.invoice_id}:`, err);
              }
            }
            
            // Debug: Check count right after inserts
            console.log('[invoiceService] Insert loop completed, checking database...');
            
            // Return fresh data from API
            const updatedLocal = await localDB.getInvoices();
            console.log(`[invoiceService] After sync, ${updatedLocal.length} invoices in local DB`);
            return updatedLocal.map(localRowToInvoice);
          } else {
            console.log('[invoiceService] API returned no invoices or status false');
            // Return local data if API returns empty
            return localInvoices.map(localRowToInvoice);
          }
        } catch (error) {
          console.error('[invoiceService] API fetch failed, using cached data:', error);
          // If API fails, return local data
          return localInvoices.map(localRowToInvoice);
        }
      }
      
      // Return local data (either we're offline or API call completed)
      return localInvoices.map(localRowToInvoice);
    } catch (error) {
      console.error('[invoiceService] getAllInvoices error:', error);
      return [];
    }
  },

  /**
   * Get a single invoice by ID - OFFLINE FIRST
   */
  async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const invoice = await localDB.getInvoiceById(id);
      return invoice ? localRowToInvoice(invoice) : null;
    } catch (error) {
      console.error('[invoiceService] getInvoiceById error:', error);
      return null;
    }
  },

  /**
   * Create a new invoice - OFFLINE FIRST
   * 1. Save to local DB immediately with items and payments
   * 2. If online, sync to API
   */
  async createInvoice(invoiceData: {
    invoice: Partial<Invoice>;
    items: Array<{
      id: number;
      quantity: number;
      description: string;
      price: number;
      shop_id?: number;
    }>;
    payments: Array<{
      amount: number;
      account_id: number;
      payment_method?: number;
      date: string;
      reference?: string;
    }>;
  }): Promise<Invoice | null> {
    try {
      const { invoice, items, payments } = invoiceData;
      
      // Save invoice locally first
      const localInvoice = await localDB.addInvoice({
        ...invoice,
        synced: 0, // Mark as unsynced
      });

      // Save invoice items locally
      for (const item of items) {
        await localDB.addInvoiceItem({
          invoiceId: localInvoice.id,
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          description: item.description,
          shopId: item.shop_id,
        });
      }

      // Save invoice payments locally
      for (const payment of payments) {
        await localDB.addInvoicePayment({
          invoiceId: localInvoice.id,
          amount: payment.amount,
          accountId: payment.account_id,
          paymentMethod: payment.payment_method,
          date: payment.date,
          reference: payment.reference,
        });
      }

      // Try to sync to API if online
      const online = await isOnline();
      if (online) {
        try {
          // Check if customer has a local ID (not yet synced)
          const hasLocalCustomerId = invoice.customerId?.toString().startsWith('local_');
          
          if (hasLocalCustomerId) {
            console.log('[invoiceService] Customer not synced yet (local ID), will sync invoice later');
            // Don't sync invoice yet - it will be synced when customer is synced
            return localRowToInvoice(localInvoice);
          }
          
          const axios = getAxiosInstance();
          
          // Prepare API payload
          const payload = {
            customer_type: invoice.customerType || 'Customer',
            customer_id: parseInt(invoice.customerId || '0') || 0,
            issue_date: invoice.issueDate,
            due_date: invoice.dueDate,
            category_id: parseInt(invoice.categoryId || '0') || 0,
            warehouse_id: parseInt(invoice.warehouseId || '0') || 0,
            ref_number: invoice.refNumber,
            delivery_status: invoice.deliveryStatus || 'Pending',
            items: items.map(item => ({
              id: item.id,
              quantity: item.quantity,
              description: item.description,
              price: item.price,
              shop_id: item.shop_id || 1,
            })),
            payments: payments.map(payment => ({
              amount: payment.amount,
              account_id: payment.account_id,
              payment_method: payment.payment_method || 1,
              date: payment.date,
              reference: payment.reference || '',
            })),
          };

          console.log('[invoiceService] Syncing invoice to API:', payload);
          const response = await axios.post('/invoice/store', payload);
          
          if (response.data?.status) {
            const serverId = response.data?.data?.id || response.data?.data?.invoice_id;
            if (serverId) {
              await localDB.markInvoiceAsSynced(localInvoice.id, String(serverId));
              console.log('[invoiceService] Invoice synced successfully, serverId:', serverId);
            }
          }
        } catch (error: any) {
          console.error('[invoiceService] API sync failed, will retry later:', error);
          console.error('[invoiceService] Error details:', error.response?.data);
        }
      } else {
        console.log('[invoiceService] Offline mode - invoice saved locally for later sync');
      }

      return localRowToInvoice(localInvoice);
    } catch (error) {
      console.error('[invoiceService] createInvoice error:', error);
      return null;
    }
  },

  /**
   * Update an invoice - OFFLINE FIRST
   */
  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<boolean> {
    try {
      await localDB.updateInvoice(id, {
        ...updates,
        synced: 0, // Mark as unsynced
      });

      // Try to sync to API if online
      const online = await isOnline();
      if (online) {
        try {
          const axios = getAxiosInstance();
          // TODO: Implement actual API endpoint for updating invoices
          // const response = await axios.put(`/invoices/${id}`, updates);
          // if (response.data.success) {
          //   await localDB.markInvoiceAsSynced(id);
          // }
        } catch (error) {
          console.error('[invoiceService] API sync failed, will retry later:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('[invoiceService] updateInvoice error:', error);
      return false;
    }
  },

  /**
   * Delete an invoice - OFFLINE FIRST
   */
  async deleteInvoice(id: string): Promise<boolean> {
    try {
      await localDB.deleteInvoice(id);

      // Try to sync deletion to API if online
      const online = await isOnline();
      if (online) {
        try {
          const axios = getAxiosInstance();
          // TODO: Implement actual API endpoint for deleting invoices
          // await axios.delete(`/invoices/${id}`);
        } catch (error) {
          console.error('[invoiceService] API sync failed:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('[invoiceService] deleteInvoice error:', error);
      return false;
    }
  },

  /**
   * Sync unsynced invoices to API
   */
  async syncInvoices(): Promise<void> {
    try {
      const online = await isOnline();
      if (!online) {
        console.log('[invoiceService] Offline, skipping sync');
        return;
      }

      const unsynced = await localDB.getUnsyncedInvoices();
      if (unsynced.length === 0) {
        console.log('[invoiceService] No unsynced invoices');
        return;
      }

      console.log(`[invoiceService] Syncing ${unsynced.length} invoices...`);

      const axios = getAxiosInstance();
      for (const invoice of unsynced) {
        try {
          // Check if customer has a local ID (not yet synced)
          const hasLocalCustomerId = invoice.customerId?.toString().startsWith('local_');
          
          if (hasLocalCustomerId) {
            console.log(`[invoiceService] Skipping invoice ${invoice.invoiceNo} - customer not synced yet`);
            continue;
          }
          
          // Get invoice items and payments
          const items = await localDB.getInvoiceItems(invoice.id);
          const payments = await localDB.getInvoicePayments(invoice.id);
          
          const payload = {
            customer_type: invoice.customerType || 'Customer',
            customer_id: parseInt(invoice.customerId || '0') || 0,
            issue_date: invoice.issueDate,
            due_date: invoice.dueDate,
            category_id: parseInt(invoice.categoryId || '0') || 0,
            warehouse_id: parseInt(invoice.warehouseId || '0') || 0,
            ref_number: invoice.refNumber,
            delivery_status: invoice.deliveryStatus || 'Pending',
            items: items.map(item => ({
              id: item.productId,
              quantity: item.quantity,
              description: item.description || '',
              price: item.price,
              shop_id: item.shopId || 1,
            })),
            payments: payments.map(payment => ({
              amount: payment.amount,
              account_id: payment.accountId,
              payment_method: payment.paymentMethod || 1,
              date: payment.date,
              reference: payment.reference || '',
            })),
          };
          
          const response = await axios.post('/invoice/store', payload);
          
          if (response.data?.status) {
            const serverId = response.data?.data?.id || response.data?.data?.invoice_id;
            if (serverId) {
              await localDB.markInvoiceAsSynced(invoice.id, String(serverId));
              console.log(`[invoiceService] Invoice ${invoice.invoiceNo} synced successfully`);
            }
          }
        } catch (error) {
          console.error(`[invoiceService] Failed to sync invoice ${invoice.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[invoiceService] syncInvoices error:', error);
    }
  },
};
