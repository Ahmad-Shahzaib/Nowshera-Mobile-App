import { getAxiosInstance } from '@/lib/axios';
import { Invoice, InvoiceApi, InvoiceApiResponse, InvoiceDetailApi, InvoiceDetailApiResponse, InvoiceDetailItem, InvoicePayment, InvoiceTotals } from '@/types/invoice';
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
     * Get count of unsynced invoices (for dashboard)
     */
    async getUnsyncedCount(): Promise<number> {
      try {
        if (typeof localDB.getUnsyncedInvoices === 'function') {
          const unsynced = await localDB.getUnsyncedInvoices();
          return unsynced.length;
        }
        // fallback: return 0 if method is not available
        return 0;
      } catch (error) {
        console.error('[invoiceService] Error getting unsynced invoice count:', error);
        return 0;
      }
    },
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
            
            // Also include any local unsynced invoices so offline-created invoices
            // remain visible when the app is online (unsynced items should appear first).
            try {
              const unsyncedLocalRows = await localDB.getUnsyncedInvoices();
              const unsyncedInvoices = unsyncedLocalRows
                // map DB rows to Invoice objects
                .map(localRowToInvoice)
                // filter out any that might accidentally match server-side invoices
                .filter(u => !invoices.some(a => (a.serverId && u.serverId) ? a.serverId === u.serverId : a.invoiceNo === u.invoiceNo));

              if (unsyncedInvoices.length > 0) {
                console.log(`[invoiceService] Merging ${unsyncedInvoices.length} local unsynced invoices into API results`);
              }

              const merged = [...unsyncedInvoices, ...invoices];

              return {
                invoices: merged,
                total: total + unsyncedInvoices.length,
                currentPage: page,
                totalPages
              };
            } catch (err) {
              // If reading local DB fails for any reason, fall back to API-only response
              console.error('[invoiceService] Failed to load unsynced local invoices:', err);
              return {
                invoices,
                total,
                currentPage: page,
                totalPages
              };
            }
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
   * ✔ If offline: Save to local DB as UNSYNCED, sync later when online
   * ✔ If online: Try to sync to API immediately
   *   - On success: Mark as SYNCED (do NOT store in local DB)
   *   - On failure (e.g., 422): Mark as FAILED with error message
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
    const { invoice, items, payments } = invoiceData;
    const online = await isOnline();

    // Check if customer has a local ID (not yet synced to server)
    const hasLocalCustomerId = invoice.customerId?.toString().startsWith('local_');

    if (online && !hasLocalCustomerId) {
      // ONLINE PATH: Try to sync to API immediately
      try {
        const axios = getAxiosInstance();

        // Prepare API payload - payments can be empty array
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

        console.log('[invoiceService] Online - Syncing invoice to API:', payload);
        const response = await axios.post('/invoice/store', payload);

        if (response.data?.status) {
          const serverId = response.data?.data?.id || response.data?.data?.invoice_id;
          console.log('[invoiceService] ✓ Invoice created on server successfully (ID: ' + serverId + ')');
          
          // Return success without storing in local DB (successful online invoices don't need local storage)
          return {
            id: `temp_${Date.now()}`,
            invoiceNo: invoice.invoiceNo || `#INVO${String(Date.now()).slice(-5)}`,
            customerId: invoice.customerId || '0',
            customerName: invoice.customerName || 'Unknown',
            warehouseId: invoice.warehouseId || '0',
            issueDate: invoice.issueDate || new Date().toISOString(),
            subTotal: invoice.subTotal || '0',
            discountTotal: invoice.discountTotal || '0',
            taxTotal: invoice.taxTotal || '0',
            grandTotal: invoice.grandTotal || '0',
            dueAmount: invoice.dueAmount || '0',
            status: invoice.status || 'Unpaid',
            serverId: String(serverId),
            synced: 1,
            syncStatus: 'SYNCED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Invoice;
        } else {
          throw new Error('API returned status false');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error('[invoiceService] ✗ Failed to create invoice on server:', errorMsg);

        // Save locally as FAILED for later inspection
        const localInvoice = await localDB.addInvoice({
          ...invoice,
          synced: 0,
          syncStatus: 'FAILED',
          syncError: errorMsg,
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

        return localRowToInvoice(localInvoice);
      }
    } else {
      // OFFLINE PATH: Save to local DB as UNSYNCED
      const syncStatus = 'UNSYNCED';
      console.log('[invoiceService] 🔴 Offline detected — invoice saved locally (UNSYNCED)');
      console.log(`[invoiceService] Invoice details: customerId=${invoice.customerId}, invoiceNo=${invoice.invoiceNo}`);

      const localInvoice = await localDB.addInvoice({
        ...invoice,
        synced: 0,
        syncStatus,
      });

      console.log(`[invoiceService] ✓ Invoice stored in local DB with id: ${localInvoice.id}, syncStatus: ${localInvoice.syncStatus}, synced: ${localInvoice.synced}`);

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

      console.log(`[invoiceService] ✓ Saved ${items.length} invoice items`);

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

      console.log(`[invoiceService] ✓ Saved ${payments.length} invoice payments`);
      console.log('[invoiceService] 📦 Offline invoice ready for sync when online');
      return localRowToInvoice(localInvoice);
    }
  },

  /**
   * Update an invoice - OFFLINE FIRST
   */
  async updateInvoice(
    invoiceId: string | number,
    updateData: {
      issue_date: string;
      due_date: string;
      category_id: number;
      warehouse_id: number;
      customer_id: number;
      delivery_status: string;
      sale_type: string;
      ref_number?: string;
      discount_apply: number;
      items: Array<{
        id: number;
        quantity: number;
        price: number;
        description: string;
        discount?: number;
        tax?: number;
      }>;
      payments: Array<{
        date: string;
        amount: number;
        account_id: number;
        payment_method: number;
        reference: string;
        description?: string;
      }>;
    }
  ): Promise<{
    success: boolean;
    message: string;
    total: number;
    paid: number;
    due: number;
  }> {
    try {
      // Check network status
      const online = await isOnline();
      console.log(`[invoiceService] updateInvoice - invoiceId: ${invoiceId}, online: ${online}`);

      if (online) {
        try {
          // Resolve whether the provided invoiceId maps to a server-side ID
          let apiInvoiceId: string | number = invoiceId;

          try {
            const localAttempt = await localDB.getInvoiceById(invoiceId.toString());
            if (localAttempt && localAttempt.serverId && /^\d+$/.test(String(localAttempt.serverId))) {
              apiInvoiceId = localAttempt.serverId;
              console.log(`[invoiceService] Resolved server invoice id ${apiInvoiceId} for local id ${invoiceId}`);
            }
          } catch (err) {
            // ignore local DB lookup errors and proceed to use invoiceId as-is
            console.warn('[invoiceService] Failed to resolve local invoice for server id lookup:', err);
          }

          // If invoiceId is not a numeric server id, perform the offline update flow
          if (!/^[0-9]+$/.test(String(apiInvoiceId))) {
            console.log(`[invoiceService] Invoice id ${invoiceId} does not have a server id - performing local update instead of API call`);
            // Reuse the offline update branch (mark as unsynced)
            // Get the local invoice (try by id or serverId)
            let localInvoice = await localDB.getInvoiceById(invoiceId.toString());
            if (!localInvoice) {
              const allInvoices = await localDB.getInvoices();
              localInvoice = allInvoices.find(inv => inv.serverId === invoiceId.toString()) || null;
            }

            if (!localInvoice) {
              return {
                success: false,
                message: `Invoice ${invoiceId} not found locally`,
                total: 0,
                paid: 0,
                due: 0,
              };
            }

            // Perform local update (same logic as offline branch below)
            const itemSubTotal = updateData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
            const itemDiscountTotal = updateData.items.reduce((sum, item) => sum + (item.discount || 0), 0);
            const itemTaxTotal = updateData.items.reduce((sum, item) => sum + (item.tax || 0), 0);
            const grandTotal = itemSubTotal - itemDiscountTotal + itemTaxTotal;
            const paidAmount = updateData.payments.reduce((sum, payment) => sum + payment.amount, 0);
            const dueAmount = grandTotal - paidAmount;

            await localDB.updateInvoice(localInvoice.id, {
              issueDate: updateData.issue_date,
              dueDate: updateData.due_date,
              warehouseId: updateData.warehouse_id.toString(),
              subTotal: itemSubTotal.toString(),
              discountTotal: itemDiscountTotal.toString(),
              taxTotal: itemTaxTotal.toString(),
              grandTotal: grandTotal.toString(),
              dueAmount: dueAmount.toString(),
              synced: 0,
            });

            await localDB.deleteInvoiceItems(localInvoice.id);
            await localDB.deleteInvoicePayments(localInvoice.id);

            for (const item of updateData.items) {
              await localDB.addInvoiceItem({
                invoiceId: localInvoice.id,
                productId: item.id,
                quantity: item.quantity,
                price: item.price,
                description: item.description,
              });
            }

            for (const payment of updateData.payments) {
              await localDB.addInvoicePayment({
                invoiceId: localInvoice.id,
                amount: payment.amount,
                accountId: payment.account_id,
                paymentMethod: payment.payment_method,
                date: payment.date,
                reference: payment.reference,
              });
            }

            console.log(`[invoiceService] Invoice ${invoiceId} updated locally (marked for sync)`);

            return {
              success: true,
              message: 'Invoice updated locally (will sync when possible)',
              total: grandTotal,
              paid: paidAmount,
              due: dueAmount,
            };
          }

          const axios = getAxiosInstance();
          const response = await axios.put(
            `/invoice/${apiInvoiceId}/update`,
            updateData
          );

          console.log(`[invoiceService] API Response:`, response.data);

          // Ensure response.data exists and has the expected structure
          if (!response.data) {
            console.warn(`[invoiceService] API returned empty response`);
            return {
              success: false,
              message: 'Empty response from server',
              total: 0,
              paid: 0,
              due: 0,
            };
          }

          if (response.data.success) {
            console.log(`[invoiceService] Invoice ${apiInvoiceId} updated successfully`);
            const total = typeof response.data.total === 'number' ? response.data.total : (typeof response.data.data?.total === 'number' ? response.data.data.total : 0);
            const paid = typeof response.data.paid === 'number' ? response.data.paid : (typeof response.data.data?.paid === 'number' ? response.data.data.paid : 0);
            const due = typeof response.data.due === 'number' ? response.data.due : (typeof response.data.data?.due === 'number' ? response.data.data.due : 0);

            return {
              success: true,
              message: response.data.message || 'Invoice updated successfully',
              total: total ?? 0,
              paid: paid ?? 0,
              due: due ?? 0,
            };
          } else {
            console.warn(`[invoiceService] API returned success: false`);
            console.warn(`[invoiceService] Response data:`, response.data);
            return {
              success: false,
              message: response.data?.message || 'Failed to update invoice',
              total: 0,
              paid: 0,
              due: 0,
            };
          }
        } catch (error: any) {
          console.error(`[invoiceService] API update invoice failed:`, error.message);
          console.error(`[invoiceService] Error details:`, error.response?.data);
          return {
            success: false,
            message: error.response?.data?.message || error.message || 'Failed to update invoice',
            total: 0,
            paid: 0,
            due: 0,
          };
        }
      } else {
        // Offline mode - save to local DB
        console.log(`[invoiceService] Offline mode - updating local DB`);
        
        try {
          // Get the local invoice (try by id or serverId)
          let localInvoice = await localDB.getInvoiceById(invoiceId.toString());
          
          if (!localInvoice) {
            // Try to find by serverId if not found by id
            const allInvoices = await localDB.getInvoices();
            localInvoice = allInvoices.find(inv => inv.serverId === invoiceId.toString()) || null;
          }
          
          if (!localInvoice) {
            return {
              success: false,
              message: `Invoice ${invoiceId} not found`,
              total: 0,
              paid: 0,
              due: 0,
            };
          }
          
          // Calculate totals from items
          const itemSubTotal = updateData.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
          const itemDiscountTotal = updateData.items.reduce((sum, item) => sum + (item.discount || 0), 0);
          const itemTaxTotal = updateData.items.reduce((sum, item) => sum + (item.tax || 0), 0);
          const grandTotal = itemSubTotal - itemDiscountTotal + itemTaxTotal;
          
          // Calculate paid amount from payments
          const paidAmount = updateData.payments.reduce((sum, payment) => sum + payment.amount, 0);
          const dueAmount = grandTotal - paidAmount;
          
          // Update invoice in local DB
          await localDB.updateInvoice(localInvoice.id, {
            issueDate: updateData.issue_date,
            dueDate: updateData.due_date,
            warehouseId: updateData.warehouse_id.toString(),
            subTotal: itemSubTotal.toString(),
            discountTotal: itemDiscountTotal.toString(),
            taxTotal: itemTaxTotal.toString(),
            grandTotal: grandTotal.toString(),
            dueAmount: dueAmount.toString(),
            synced: 0, // Mark as unsynced for later sync
          });
          
          // Delete old items and payments
          await localDB.deleteInvoiceItems(localInvoice.id);
          await localDB.deleteInvoicePayments(localInvoice.id);
          
          // Add new items
          for (const item of updateData.items) {
            await localDB.addInvoiceItem({
              invoiceId: localInvoice.id,
              productId: item.id,
              quantity: item.quantity,
              price: item.price,
              description: item.description,
            });
          }
          
          // Add new payments
          for (const payment of updateData.payments) {
            await localDB.addInvoicePayment({
              invoiceId: localInvoice.id,
              amount: payment.amount,
              accountId: payment.account_id,
              paymentMethod: payment.payment_method,
              date: payment.date,
              reference: payment.reference,
            });
          }
          
          console.log(`[invoiceService] Invoice ${invoiceId} updated locally (marked for sync)`);
          
          return {
            success: true,
            message: 'Invoice updated (will sync when online)',
            total: grandTotal,
            paid: paidAmount,
            due: dueAmount,
          };
        } catch (error: any) {
          console.error(`[invoiceService] Offline update failed:`, error.message);
          return {
            success: false,
            message: error.message || 'Failed to update invoice offline',
            total: 0,
            paid: 0,
            due: 0,
          };
        }
      }
    } catch (error: any) {
      console.error('[invoiceService] Error updating invoice:', error);
      return {
        success: false,
        message: error.message || 'Failed to update invoice',
        total: 0,
        paid: 0,
        due: 0,
      };
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

  /**
   * Fetch invoice detail with items and payments - OFFLINE FIRST
   * GET /invoice/:id/edit endpoint
   */
  async getInvoiceDetail(invoiceId: string | number): Promise<{
    invoice: InvoiceDetailApi;
    items: InvoiceDetailItem[];
    payments: InvoicePayment[];
    totals: InvoiceTotals;
  } | null> {
    try {
      // Check network status
      const online = await isOnline();
      console.log(`[invoiceService] getInvoiceDetail - invoiceId: ${invoiceId}, online: ${online}`);
      
      if (online) {
        try {
          const axios = getAxiosInstance();
          // Use the invoice ID for API call
          const response = await axios.get<InvoiceDetailApiResponse>(`/invoice/${invoiceId}/edit`);
          console.log(`[invoiceService] API Response:`, response.data);

          if (response.data.success) {
            console.log(`[invoiceService] Fetched invoice detail ${invoiceId} from API`);
            return {
              invoice: response.data.invoice,
              items: response.data.items,
              payments: response.data.payments,
              totals: response.data.totals,
            };
          } else {
            console.warn(`[invoiceService] API returned success: false`);
          }
        } catch (error: any) {
          console.warn(`[invoiceService] API fetch invoice detail failed:`, error.message);
          console.warn(`[invoiceService] Error details:`, error.response?.data);
          // Fall through to offline mode
        }
      }

      // Offline: Return from local DB (try both id and serverId)
      console.log(`[invoiceService] Falling back to local DB for invoiceId: ${invoiceId}`);
      let localInvoice = await localDB.getInvoiceById(invoiceId.toString());
      
      // If not found and invoiceId looks like a number, try as serverId
      if (!localInvoice && typeof invoiceId === 'string' && /^\d+$/.test(invoiceId)) {
        // Try to find by serverId instead
        const allInvoices = await localDB.getInvoices();
        localInvoice = allInvoices.find(inv => inv.serverId === invoiceId.toString()) || null;
      }

      if (!localInvoice) {
        console.warn(`[invoiceService] Invoice ${invoiceId} not found in local DB`);
        return null;
      }

      console.log(`[invoiceService] Found invoice in local DB`);
      const items = await localDB.getInvoiceItems(localInvoice.id);
      const payments = await localDB.getInvoicePayments(localInvoice.id);

      // Convert local data to match API response format
      return {
        invoice: {
          id: parseInt(localInvoice.serverId || '0') || 0,
          invoice_number: parseInt(localInvoice.invoiceNo.replace('#INVO', '')) || 0,
          issue_date: localInvoice.issueDate,
          due_date: localInvoice.dueDate || localInvoice.issueDate,
          warehouse_id: parseInt(localInvoice.warehouseId || '0') || 0,
          category_id: 0,
          customer_id: parseInt(localInvoice.customerId || '0') || 0,
          customer_name: localInvoice.customerName,
          contact_number: null,
          address: null,
          delivery_status: 'Pending',
          current_balance: '0',
          discount_apply: 0,
          ref_number: null,
          status: localInvoice.status === 'Paid' ? 1 : localInvoice.status === 'Partially Paid' ? 2 : 3,
          sale_type: 'single_warehouse',
        },
        items: items.map(item => ({
          id: item.id ? parseInt(item.id) : 0,
          quantity: item.quantity,
          price: item.price.toString(),
          discount: 0,
          discount_percentage: '0.00',
          tax: null,
          description: item.description || '',
          subtotal: parseInt(item.price.toString()) * item.quantity,
        })),
        payments: payments.map(payment => ({
          id: payment.id ? parseInt(payment.id) : 0,
          date: payment.date,
          amount: (typeof payment.amount === 'string' ? payment.amount : payment.amount.toString()),
          account_id: payment.accountId || 0,
          payment_method: payment.paymentMethod || 1,
          reference: payment.reference || '',
          description: '',
        })),
        totals: {
          sub_total: parseInt(localInvoice.subTotal) || 0,
          discount: parseInt(localInvoice.discountTotal) || 0,
          tax: parseInt(localInvoice.taxTotal) || 0,
          total: parseInt(localInvoice.grandTotal) || 0,
          paid: parseInt(localInvoice.grandTotal) - parseInt(localInvoice.dueAmount),
          due: parseInt(localInvoice.dueAmount) || 0,
        },
      };
    } catch (error: any) {
      console.error('[invoiceService] Error fetching invoice detail:', error);
      return null;
    }
  },
};
