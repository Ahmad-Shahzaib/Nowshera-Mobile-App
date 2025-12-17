# Sync Sequence Implementation

## Overview
This document describes the implementation that ensures **customers are always synchronized before their invoices** to the server. This is critical because invoices have foreign key references to customers, and we need the real server-generated customer IDs before syncing invoices.

## Problem Statement
When working offline:
1. Users create customers (which get local IDs like `local_1234567890_1`)
2. Users create invoices referencing those local customer IDs
3. When syncing, if invoices are synced before customers, they will have invalid customer IDs

## Solution Architecture

### 1. Sequential Sync Process
The `syncAll()` function in `services/syncService.ts` implements a **strict sequential sync**:

```
Step 1: Sync ALL customers first
  → Customer gets created on server
  → Server returns real customer ID
  → Local database updates: marks customer as synced
  → Local database updates: ALL invoices referencing this customer get updated with real ID

Step 2: Sync invoices (after all customers are synced)
  → Invoice references are now valid server IDs
  → Invoices can be successfully created on server
```

### 2. Customer Sync (`syncUnsyncedCustomers`)

**What it does:**
- Gets all unsynced customers from local database
- Sends each customer to server API: `POST /customers/store`
- Receives server-generated customer ID
- Marks customer as synced in local DB with `serverId`
- **CRITICAL**: Updates ALL invoices that reference this local customer ID with the new server ID

**Key Code:**
```typescript
// Mark customer as synced
await localDB.markAsSynced(row.id, String(serverId));

// Update all invoices that reference this local customer ID
await localDB.updateInvoicesCustomerId(row.id, String(serverId));
```

### 3. Invoice Sync (`syncUnsyncedInvoices`)

**What it does:**
- Gets all unsynced invoices from local database
- For each invoice:
  1. **Checks if customer has local ID** (starts with `local_`)
     - If yes, tries to resolve to server ID
     - If customer not synced yet, skips the invoice
  2. **Resolves customer ID** to server ID by checking local customer record
  3. Resolves bank account IDs for payments
  4. Sends invoice to server API: `POST /invoice/store`
  5. Marks invoice as synced with server ID

**Safety Checks:**
```typescript
// Check if customer has been synced
const customer = await localDB.getCustomerById(row.customerId);
if (customer && customer.serverId) {
  // Use server ID
  resolvedCustomerId = parseInt(customer.serverId);
} else if (customer && !customer.serverId) {
  // Customer not synced - skip invoice
  skipped.push(row.invoiceNo);
  continue;
}
```

### 4. Database Helper Function

**Function:** `updateInvoicesCustomerId(oldCustomerId, newCustomerId)`
- Updates ALL invoices in local database
- Changes `customerId` from local ID to server ID
- Called immediately after customer is synced

```sql
UPDATE invoices 
SET customerId = ?, updatedAt = ? 
WHERE customerId = ?
```

## Sync Flow Diagram

```
User Creates Data Offline
         ↓
    Local Database
    (local_123) Customer
    (Invoice refs local_123)
         ↓
    Network Available
         ↓
   syncAll() Called
         ↓
   ┌─────────────────────┐
   │ STEP 1: Customers   │
   └─────────────────────┘
         ↓
   Sync customer to server
         ↓
   Server returns ID: 456
         ↓
   Update local DB:
   - Mark customer synced (serverId = 456)
   - Update ALL invoices: local_123 → 456
         ↓
   ┌─────────────────────┐
   │ STEP 2: Invoices    │
   └─────────────────────┘
         ↓
   Sync invoice to server
   (with customerId = 456)
         ↓
   Server creates invoice
   Server returns invoice ID
         ↓
   Mark invoice as synced
         ↓
   ✓ Complete!
```

## Logging

The implementation includes comprehensive logging to track the sync process:

### Customer Sync Logs:
```
[syncService] Found 3 unsynced customers to process
[syncService] Syncing customer: Ahmad Khan (local ID: local_1234567890_1)...
[syncService] ✓ Customer 'Ahmad Khan' synced successfully (server ID: 456)
[syncService]   → Updating all invoices with customerId local_1234567890_1 to 456
```

### Invoice Sync Logs:
```
[syncService] Found 5 unsynced invoices to process
[syncService] Resolved customer ID from local local_1234567890_1 to server 456
[syncService] Syncing invoice INV-001 to server (customer ID: 456)...
[syncService] ✓ Invoice INV-001 synced successfully (server ID: 789)
```

### Summary Logs:
```
[syncService] ✓ Step 1 complete: 3 customers synced
[syncService] ✓ Step 2 complete: 5 invoices synced
[syncService] ✓ Sync complete: Total 8 items synced (3 customers, 5 invoices)
```

## Error Handling

### If Customer Sync Fails:
- Error is logged
- Other customers continue to sync
- Invoices referencing failed customer will be skipped

### If Invoice Customer Not Synced:
```
[syncService] ⚠️ Skipping invoice INV-001 - customer local_123 not synced yet
```
- Invoice is skipped (not synced)
- Will retry on next sync attempt

### If Invoice Sync Fails:
- Error is logged with specific invoice number
- Other invoices continue to sync
- Failed invoice remains unsynced for retry

## SyncContext Integration

The `SyncContext.tsx` coordinates the overall sync process:

```typescript
syncNow() → calls syncAll()
  ↓
Phase 1: Upload local data
  → syncAll() ensures customers before invoices
  ↓
Phase 2: Download fresh data from server
  → Sync products, categories, warehouses, etc.
```

## Auto-Sync

When device comes back online:
```typescript
if (isConnected && unsyncedCount > 0 && !isSyncing) {
  await syncNow();
}
```

## Testing Checklist

To verify the implementation works correctly:

1. **Offline Creation:**
   - [ ] Create a customer offline (gets local ID)
   - [ ] Create invoice for that customer offline
   - [ ] Verify invoice references local customer ID

2. **Sync Process:**
   - [ ] Go online and trigger sync
   - [ ] Check logs: customer synced first
   - [ ] Check logs: invoices updated with server customer ID
   - [ ] Check logs: invoices synced second

3. **Verification:**
   - [ ] Check server: customer exists with correct data
   - [ ] Check server: invoice exists with correct customer_id reference
   - [ ] Check local DB: customer has serverId
   - [ ] Check local DB: invoice has updated customerId

4. **Edge Cases:**
   - [ ] Create multiple customers and invoices
   - [ ] Sync with intermittent connection
   - [ ] Verify all relationships maintained

## Files Modified

1. **services/syncService.ts**
   - Enhanced `syncAll()` with sequential logic and logging
   - Improved `syncUnsyncedCustomers()` with customer ID updates
   - Enhanced `syncUnsyncedInvoices()` with customer ID resolution

2. **context/SyncContext.tsx**
   - Added detailed logging for sync phases
   - Clarified sync sequence in logs

3. **services/localDatabase.ts**
   - Already has `updateInvoicesCustomerId()` function (no changes needed)

## Summary

✅ **Customers are ALWAYS synced before invoices**
✅ **Invoice customer IDs are automatically updated when customer syncs**
✅ **Comprehensive logging tracks the entire process**
✅ **Error handling ensures partial sync success**
✅ **Safe to retry sync on failure**

The implementation ensures data integrity and maintains proper foreign key relationships between customers and invoices, even when working offline.
