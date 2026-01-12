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
    console.log('[syncService] ========== syncAll() STARTED ==========');
    const online = await isOnline();
    console.log(`[syncService] Network online: ${online}`);
    
    if (!online) {
      console.log('[syncService] ✗ Cannot sync - offline');
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    console.log('[syncService] Step 1: Syncing customers first...');
    // STEP 1: Sync customers first (critical for invoice foreign keys)
    const customerResult = await syncUnsyncedCustomers();
    console.log(`[syncService] Customer sync result:`, customerResult);
    
    if (customerResult.syncedCount > 0) {
      console.log(`[syncService] ✓ Step 1 complete: ${customerResult.syncedCount} customers synced`);
    } else {
      console.log('[syncService] ✓ Step 1 complete: No customers to sync');
    }
    
    console.log('[syncService] Step 2: Syncing invoices...');
    // STEP 2: Sync invoices (now all customer IDs should be synchronized)
    const invoiceResult = await syncUnsyncedInvoices();
    console.log(`[syncService] Invoice sync result:`, invoiceResult);
    
    if (invoiceResult.syncedCount > 0) {
      console.log(`[syncService] ✓ Step 2 complete: ${invoiceResult.syncedCount} invoices synced`);
    } else {
      console.log('[syncService] ✓ Step 2 complete: No invoices to sync');
    }

    const totalSynced = customerResult.syncedCount + invoiceResult.syncedCount;
    console.log(`[syncService] ========== syncAll() COMPLETE: ${totalSynced} items synced ==========`);

    return {
      success: customerResult.success && invoiceResult.success,
      syncedCount: totalSynced,
      error: [customerResult.error, invoiceResult.error].filter(Boolean).join('; ') || undefined
    };
  } catch (error: any) {
    console.error('[syncService] ✗ Error in syncAll:', error?.message);
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
    console.log('[syncService] ===== syncUnsyncedInvoices() START =====');
    
    const online = await isOnline();
    console.log(`[syncService] Is online: ${online}`);
    if (!online) {
      console.log('[syncService] ✗ Offline - cannot sync');
      return { success: false, syncedCount: 0, error: 'No internet connection' };
    }

    console.log('[syncService] Fetching unsynced invoices from DB...');
    const unsynced = await localDB.getUnsyncedInvoices();
    console.log(`[syncService] ✓ Found ${unsynced.length} unsynced invoices`);
    
    if (unsynced.length === 0) {
      console.log('[syncService] No invoices to sync');
      return { success: true, syncedCount: 0 };
    }

    console.log('[syncService] Unsynced invoices details:');
    for (const inv of unsynced) {
      console.log(`[syncService]   - #${inv.invoiceNo}: customer=${inv.customerId}, status=${inv.syncStatus}`);
    }

    const axios = getAxiosInstance();
    let syncedCount = 0;
    const errors: string[] = [];
    const skipped: string[] = [];

    console.log('[syncService] Starting invoice sync loop...');
    for (const row of unsynced) {
      let payload: any = null;
      try {
        console.log(`[syncService] >>> Processing #${row.invoiceNo}...`);
        
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
        console.log(`[syncService] Fetching items for invoice ${row.invoiceNo}...`);
        const items = await localDB.getInvoiceItems(row.id);
        console.log(`[syncService] Fetched ${items.length} items for invoice ${row.invoiceNo}`);
        
        console.log(`[syncService] Fetching payments for invoice ${row.invoiceNo}...`);
        const payments = await localDB.getInvoicePayments(row.id);
        console.log(`[syncService] Fetched ${payments.length} payments for invoice ${row.invoiceNo}`);
        
        console.log(`[syncService] Invoice ${row.invoiceNo}: ${items.length} items, ${payments.length} payments`);

        // Resolve bank account IDs to chart_of_accounts_id for payments
        console.log(`[syncService] Resolving payment accounts...`);
        console.log(`[syncService] Payments to process: ${payments.length}`, payments.map(p => ({ accountId: p.accountId, amount: p.amount })));
        
        const resolvedPayments = await Promise.all(
          payments.map(async (payment) => {
            // Get bank account to find its chartAccountId
            const bankAccount = await localDB.getBankAccountById(payment.accountId);
            
            // If bank account not found, use the account ID directly as fallback
            // This handles cases where payment.accountId doesn't map to a bank account
            let accountId = payment.accountId;
            
            if (bankAccount && bankAccount.chartAccountId) {
              accountId = bankAccount.chartAccountId;
              console.log(`[syncService] ✓ Resolved payment account ${payment.accountId} → chart_account_id ${accountId}`);
            } else {
              console.warn(`[syncService] ⚠️ Bank account ${payment.accountId} not found in DB, using accountId as-is`);
              // Try using a default bank account
              const allAccounts = await localDB.getAllBankAccounts();
              if (allAccounts.length > 0) {
                accountId = allAccounts[0].chartAccountId || allAccounts[0].id || payment.accountId;
                console.log(`[syncService] Using default bank account chartAccountId: ${accountId}`);
              }
            }
            
            // Format payment date: convert DD/MM/YYYY to YYYY-MM-DD
            let paymentDate = payment.date;
            if (paymentDate && typeof paymentDate === 'string') {
              if (paymentDate.includes('/')) {
                const parts = paymentDate.split('/');
                if (parts.length === 3) {
                  const [day, month, year] = parts;
                  paymentDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }
              }
            }
            
            return {
              amount: payment.amount,
              account_id: accountId,
              payment_method: payment.paymentMethod || 1,
              date: paymentDate,
              reference: payment.reference || '',
            };
          })
        );

        // Prepare API payload
        payload = {
          customer_type: row.customerType || 'Customer',
          customer_id: resolvedCustomerId,
          issue_date: row.issueDate,
          due_date: row.dueDate || row.issueDate,
          category_id: parseInt(row.categoryId || '0') || 9, // Default to 9 if missing
          warehouse_id: parseInt(row.warehouseId || '0') || 1, // Default to 1 if missing
          ref_number: row.refNumber || '',
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

        console.log(`[syncService] Invoice payload for ${row.invoiceNo}:`, JSON.stringify(payload, null, 2));
        console.log(`[syncService] Syncing invoice ${row.invoiceNo} to server...`);
        const response = await axios.post('/invoice/store', payload);

        if (response.data?.status) {
          const serverId = response.data?.data?.id || response.data?.data?.invoice_id;
          if (serverId) {
            console.log(`[syncService] ✓ Server accepted #${row.invoiceNo} (server ID: ${serverId})`);
            
            // Step 1: Mark as synced
            await localDB.markInvoiceAsSynced(row.id, String(serverId));
            console.log(`[syncService] ✓ Marked #${row.invoiceNo} as SYNCED in DB`);

            // Step 2: Delete invoice items from local DB
            await localDB.deleteInvoiceItems(row.id);

            // Step 3: Delete invoice payments from local DB
            await localDB.deleteInvoicePayments(row.id);

            // Step 4: Delete invoice itself from local DB
            await localDB.deleteInvoice(row.id);

            syncedCount++;
            console.log(`[syncService] <<< #${row.invoiceNo} SYNCED & REMOVED (syncedCount: ${syncedCount})`);
          } else {
            console.warn(`[syncService] ✗ No ID in response for #${row.invoiceNo}`);
            errors.push(`${row.invoiceNo}: No ID returned from server`);
          }
        } else {
          throw new Error('API returned status false');
        }
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
        
        console.warn(`[syncService] <<< #${row.invoiceNo} FAILED: ${errorMsg}`);
        errors.push(`${row.invoiceNo}: ${errorMsg}`);
        
        // Mark invoice as FAILED to prevent infinite retry loop
        // This prevents the same invoice from syncing repeatedly when there's a validation error
        // Retry up to 3 times if database is locked
        let marked = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await localDB.markInvoiceAsFailed(row.id, errorMsg);
            console.log(`[syncService] ✓ Marked #${row.invoiceNo} as FAILED (won't retry)`);
            marked = true;
            break;
          } catch (markError: any) {
            const markErrMsg = String(markError?.message || markError);
            if (/database is locked/i.test(markErrMsg) && attempt < 3) {
              console.warn(`[syncService] Database locked (attempt ${attempt}/3), retrying...`);
              await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            } else {
              console.warn(`[syncService] Failed to mark invoice as failed after ${attempt} attempt(s):`, markError);
              break;
            }
          }
        }
      }
    }

    // Build result message
    let resultMessage = '';
    if (skipped.length > 0) {
      console.warn(`[syncService] ⚠️ Skipped ${skipped.length} invoices (customer not synced)`);
      resultMessage += `${skipped.length} invoices skipped (customer not synced). `;
    }
    if (errors.length > 0) {
      console.error(`[syncService] ✗ ${errors.length} invoices failed to sync`);
      resultMessage += `${errors.length} invoices failed: ${errors.join('; ')}`;
    }

    console.log(`[syncService] ===== syncUnsyncedInvoices() RESULT: ${syncedCount} synced, ${skipped.length} skipped, ${errors.length} failed =====`);

    return { 
      success: syncedCount > 0 && errors.length === 0, 
      syncedCount,
      error: resultMessage.trim() || undefined
    };
  } catch (error: any) {
    console.error('[syncService] ✗ Exception in syncUnsyncedInvoices:', error?.message);
    return { success: false, syncedCount: 0, error: error?.message };
  }
}

export default {
  syncAll,
  syncUnsynced,
  syncUnsyncedCustomers,
  syncUnsyncedInvoices,
  isOnline,
};
