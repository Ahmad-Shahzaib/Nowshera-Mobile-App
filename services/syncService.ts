import { getAxiosInstance } from '@/lib/axios';
import * as Network from 'expo-network';
import localDB from './localDatabase';

export type SyncResult = {
  success: boolean;
  syncedCount: number;
  error?: string;
};

/**
 * Check if device is online
 */
async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isInternetReachable ?? state.isConnected ?? false;
  } catch {
    return false;
  }
}

/**
 * Sync all unsynced data (customers, invoices, etc.)
 * IMPORTANT: Customers MUST be synced first before invoices
 * to ensure invoices have the correct synchronized customer IDs
 */
export async function syncAll(): Promise<SyncResult> {
  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    console.log('[syncService] Starting sync - Step 1: Syncing customers first...');
    // STEP 1: Sync customers first (critical for invoice foreign keys)
    const customerResult = await syncUnsyncedCustomers();
    
    if (customerResult.syncedCount > 0) {
      console.log(`[syncService] ✓ Step 1 complete: ${customerResult.syncedCount} customers synced`);
    } else {
      console.log('[syncService] ✓ Step 1 complete: No customers to sync');
    }
    
    console.log('[syncService] Starting sync - Step 2: Syncing invoices...');
    // STEP 2: Sync invoices (now all customer IDs should be synchronized)
    const invoiceResult = await syncUnsyncedInvoices();
    
    if (invoiceResult.syncedCount > 0) {
      console.log(`[syncService] ✓ Step 2 complete: ${invoiceResult.syncedCount} invoices synced`);
    } else {
      console.log('[syncService] ✓ Step 2 complete: No invoices to sync');
    }

    const totalSynced = customerResult.syncedCount + invoiceResult.syncedCount;
    console.log(`[syncService] ✓ Sync complete: Total ${totalSynced} items synced (${customerResult.syncedCount} customers, ${invoiceResult.syncedCount} invoices)`);

    return {
      success: customerResult.success && invoiceResult.success,
      syncedCount: totalSynced,
      error: [customerResult.error, invoiceResult.error].filter(Boolean).join('; ') || undefined
    };
  } catch (error: any) {
    console.error('[syncService] Error in syncAll:', error);
    return { success: false, syncedCount: 0, error: error.message };
  }
}

/**
 * Sync unsynced customers to server
 */
export async function syncUnsyncedCustomers(): Promise<SyncResult> {
  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    const unsynced = await localDB.getUnsynced();
    if (unsynced.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    console.log(`[syncService] Found ${unsynced.length} unsynced customers to process`);

    const axios = getAxiosInstance();
    let syncedCount = 0;
    const errors: string[] = [];

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

        console.log(`[syncService] Syncing customer: ${row.name} (local ID: ${row.id})...`);
        const response = await axios.post('/customers/store', payload);
        const created = response?.data?.data;
        const serverId = created?.id ?? created?.customer_id;
        
        if (serverId) {
          // Mark customer as synced with server ID
          await localDB.markAsSynced(row.id, String(serverId));
          
          // CRITICAL: Update all invoices that reference this local customer ID
          // This ensures invoices created offline with local customer IDs get the real server ID
          console.log(`[syncService] ✓ Customer '${row.name}' synced successfully (server ID: ${serverId})`);
          console.log(`[syncService]   → Updating all invoices with customerId ${row.id} to ${serverId}`);
          await localDB.updateInvoicesCustomerId(row.id, String(serverId));
          
          syncedCount++;
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.warn('[syncService] Failed to sync customer:', row.id, errorMsg);
        errors.push(`${row.name}: ${errorMsg}`);

        // If this is a validation / fatal error, mark the customer as errored so
        // we don't keep retrying on every network reconnection (infinite loop).
        const isFatal = error.response?.status === 422 || /email|validation|Integrity constraint|SQLSTATE/i.test(String(errorMsg));
        if (isFatal) {
          try {
            await localDB.markCustomerAsError(row.id, errorMsg);
            console.warn(`[syncService] Marked customer ${row.id} as error to avoid repeated retries`);
          } catch (e) {
            console.warn('[syncService] Failed to mark customer as error:', e);
          }
        }
        // Continue with next customer
      }
    }

    if (errors.length > 0 && syncedCount === 0) {
      return { success: false, syncedCount: 0, error: errors.join('; ') };
    }

    return { 
      success: true, 
      syncedCount,
      error: errors.length > 0 ? `Some items failed: ${errors.join('; ')}` : undefined
    };
  } catch (error: any) {
    console.error('[syncService] Error in syncUnsyncedCustomers:', error);
    return { success: false, syncedCount: 0, error: error.message };
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function syncUnsynced(apiUrl?: string): Promise<SyncResult> {
  if (apiUrl) {
    // Old bulk sync behavior
    try {
      const unsynced = await localDB.getUnsynced();
      if (unsynced.length === 0) return { success: true, syncedCount: 0 };

      const payload = unsynced.map((r) => ({
        localId: r.id,
        name: r.name,
        contact: r.contact,
        email: r.email,
        taxNumber: r.taxNumber,
        openingBalance: r.openingBalance,
        address: r.address,
        city: r.city,
        state: r.state,
        country: r.country,
        zip: r.zip,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers: payload }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, syncedCount: 0, error: `Server responded ${res.status}: ${text}` };
      }

      const json = await res.json().catch(() => null);
      if (json && Array.isArray(json.synced)) {
        for (const s of json.synced) {
          await localDB.markAsSynced(s.localId, s.serverId);
        }
        return { success: true, syncedCount: json.synced.length };
      }

      for (const row of unsynced) {
        await localDB.markAsSynced(row.id, `server_${Date.now()}_${row.id}`);
      }

      return { success: true, syncedCount: unsynced.length };
    } catch (error: any) {
      return { success: false, syncedCount: 0, error: error.message };
    }
  }

  // Use new sync method
  return syncUnsyncedCustomers();
}

/**
 * Sync unsynced invoices to server
 * NOTE: This should only be called AFTER syncUnsyncedCustomers() completes
 * to ensure all customer IDs are properly synchronized
 */
export async function syncUnsyncedInvoices(): Promise<SyncResult> {
  try {
    const online = await isOnline();
    if (!online) {
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    const unsynced = await localDB.getUnsyncedInvoices();
    if (unsynced.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    console.log(`[syncService] Found ${unsynced.length} unsynced invoices to process`);

    const axios = getAxiosInstance();
    let syncedCount = 0;
    const errors: string[] = [];
    const skipped: string[] = [];

    for (const row of unsynced) {
      try {
        // Check if customer has a local ID (starts with "local_")
        const hasLocalCustomerId = row.customerId?.toString().startsWith('local_');
        
        if (hasLocalCustomerId) {
          // Check if customer has been synced now
          const customer = await localDB.getCustomerById(row.customerId);
          if (customer && customer.serverId) {
            // Customer was synced! Update the invoice's customer ID
            console.log(`[syncService] Updating invoice ${row.invoiceNo} customer ID from ${row.customerId} to ${customer.serverId}`);
            await localDB.updateInvoicesCustomerId(row.customerId, customer.serverId);
            // Reload the invoice with updated customer ID
            row.customerId = customer.serverId;
          } else {
            // Customer still not synced - skip this invoice
            console.warn(`[syncService] ⚠️ Skipping invoice ${row.invoiceNo} - customer ${row.customerId} not synced yet`);
            skipped.push(row.invoiceNo);
            continue;
          }
        }

        // Resolve customer ID to server ID
        let resolvedCustomerId = parseInt(row.customerId || '0') || 0;
        
        // If customerId looks like a numeric local ID, verify it has a server mapping
        const customer = await localDB.getCustomerById(row.customerId);
        if (customer && customer.serverId) {
          // Use the server ID instead of local ID
          resolvedCustomerId = parseInt(customer.serverId);
          console.log(`[syncService] Resolved customer ID from local ${row.customerId} to server ${resolvedCustomerId}`);
        } else if (customer && !customer.serverId) {
          // Customer exists locally but not synced to server - this shouldn't happen at this point
          console.error(`[syncService] ⚠️ Critical: Customer ${row.customerId} found locally but has no serverId!`);
          skipped.push(row.invoiceNo);
          continue;
        }

        // Get invoice items and payments from local DB
        const items = await localDB.getInvoiceItems(row.id);
        const payments = await localDB.getInvoicePayments(row.id);

        // Resolve bank account IDs to chart_of_accounts_id for payments
        const resolvedPayments = await Promise.all(
          payments.map(async (payment) => {
            // Get bank account to find its chartAccountId
            const bankAccount = await localDB.getBankAccountById(payment.accountId);
            const accountId = bankAccount?.chartAccountId || payment.accountId;
            
            if (bankAccount?.chartAccountId) {
              console.log(`[syncService] Resolved payment account from ${payment.accountId} to chart_account_id ${accountId}`);
            }
            
            return {
              amount: payment.amount,
              account_id: accountId,
              payment_method: payment.paymentMethod || 1,
              date: payment.date,
              reference: payment.reference || '',
            };
          })
        );

        // Prepare API payload
        const payload = {
          customer_type: row.customerType || 'Customer',
          customer_id: resolvedCustomerId,
          issue_date: row.issueDate,
          due_date: row.dueDate,
          category_id: parseInt(row.categoryId || '0') || 0,
          warehouse_id: parseInt(row.warehouseId || '0') || 0,
          ref_number: row.refNumber,
          delivery_status: row.deliveryStatus || 'Pending',
          items: items.map(item => ({
            id: item.productId,
            quantity: item.quantity,
            description: item.description || '',
            price: item.price,
            shop_id: item.shopId || 1,
          })),
          payments: resolvedPayments,
        };

        console.log(`[syncService] Syncing invoice ${row.invoiceNo} to server (customer ID: ${resolvedCustomerId})...`);
        const response = await axios.post('/invoice/store', payload);
        
        if (response.data?.status) {
          const serverId = response.data?.data?.id || response.data?.data?.invoice_id;
          if (serverId) {
            await localDB.markInvoiceAsSynced(row.id, String(serverId));
            syncedCount++;
            console.log(`[syncService] ✓ Invoice ${row.invoiceNo} synced successfully (server ID: ${serverId})`);
          }
        } else {
          throw new Error('API returned status false');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        console.error(`[syncService] ✗ Failed to sync invoice ${row.invoiceNo}:`, errorMsg);
        errors.push(`${row.invoiceNo}: ${errorMsg}`);
      }
    }

    // Build result message
    let resultMessage = '';
    if (skipped.length > 0) {
      console.warn(`[syncService] ⚠️ ${skipped.length} invoices skipped - their customers need to be synced first`);
      resultMessage += `${skipped.length} invoices skipped (customer not synced). `;
    }
    if (errors.length > 0) {
      console.error(`[syncService] ✗ ${errors.length} invoices failed to sync`);
      resultMessage += `${errors.length} invoices failed: ${errors.join('; ')}`;
    }

    if (errors.length > 0 && syncedCount === 0) {
      return { success: false, syncedCount: 0, error: errors.join('; ') };
    }

    // Log final summary
    if (syncedCount > 0 || skipped.length > 0 || errors.length > 0) {
      console.log(`[syncService] Invoice sync summary: ${syncedCount} synced, ${skipped.length} skipped, ${errors.length} failed`);
    }

    return { 
      success: true, 
      syncedCount,
      error: resultMessage.trim() || undefined
    };
  } catch (error: any) {
    console.error('[syncService] Error in syncUnsyncedInvoices:', error);
    return { success: false, syncedCount: 0, error: error.message };
  }
}

export default {
  syncAll,
  syncUnsynced,
  syncUnsyncedCustomers,
  syncUnsyncedInvoices,
  isOnline,
};
