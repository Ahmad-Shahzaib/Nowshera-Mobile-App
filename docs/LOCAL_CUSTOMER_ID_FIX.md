# Local Customer ID Fix - Invoice Sync Implementation

## Problem
When creating customers offline, they get a local ID like `local_1765520707757`. When creating invoices with these customers, the invoice would be stored in SQLite with the local customer ID. However, when syncing to the backend API:

1. The code was trying to parse `local_1765520707757` as an integer using `parseInt()`, resulting in `NaN` or `0`
2. This would cause the invoice to be synced with an invalid customer ID
3. The relationship between customer and invoice would be lost

## Solution

### 1. **Store Local IDs Properly in SQLite**
- Customer IDs are now stored as-is in SQLite (keeping the `local_` prefix)
- This maintains the relationship between invoices and customers locally

### 2. **Skip Syncing Invoices with Local Customer IDs**
In `services/invoiceService.ts`:
```typescript
// Check if customer has a local ID (not yet synced)
const hasLocalCustomerId = invoice.customerId?.toString().startsWith('local_');

if (hasLocalCustomerId) {
  console.log('[invoiceService] Customer not synced yet (local ID), will sync invoice later');
  // Don't sync invoice yet - it will be synced when customer is synced
  return localRowToInvoice(localInvoice);
}
```

### 3. **Update Invoice Customer IDs After Customer Sync**
In `services/customerService.ts`:
```typescript
// Update local customer with server ID
const oldLocalId = row.id;
await localDB.markAsSynced(oldLocalId, String(serverId));

// Update invoices that reference this local customer ID
await localDB.updateInvoicesCustomerId(oldLocalId, String(serverId));
```

### 4. **New Database Function**
Added `updateInvoicesCustomerId()` in `services/localDatabase.ts`:
```typescript
export async function updateInvoicesCustomerId(oldCustomerId: string, newCustomerId: string): Promise<void> {
  const now = new Date().toISOString();
  await execSql(
    `UPDATE invoices SET customerId = ?, updatedAt = ? WHERE customerId = ?;`,
    [newCustomerId, now, oldCustomerId]
  );
}
```

### 5. **Auto-Sync Invoices After Customer Sync**
After syncing customers, the system automatically attempts to sync their related invoices:
```typescript
// After syncing customers, try to sync their invoices
if (syncedCount > 0) {
  try {
    console.log('[customerService] Syncing related invoices...');
    await invoiceService.syncInvoices();
  } catch (error) {
    console.warn('[customerService] Failed to sync invoices:', error);
  }
}
```

## Sync Flow

### Offline Scenario:
1. User creates a customer offline → Gets `local_1234567890` ID
2. User creates an invoice with this customer → Invoice stored with `customerId: "local_1234567890"`
3. Invoice is marked as `synced: 0` (unsynced)
4. Attempting to sync invoice → Skipped because customer has local ID

### Sync Scenario:
1. Internet connection is restored
2. Customer sync begins → Customer sent to API
3. API returns server ID (e.g., `123`)
4. Local customer updated: `serverId: "123"`, `synced: 1`
5. **All invoices with `customerId: "local_1234567890"` are updated to `customerId: "123"`**
6. Invoice sync begins → Invoices now have valid server customer IDs
7. Invoices successfully synced to backend

## Benefits

1. ✅ **No Data Loss**: Relationship between customers and invoices is preserved
2. ✅ **Proper Sync Order**: Customers are synced before their invoices
3. ✅ **Automatic Recovery**: System automatically syncs pending invoices after customers are synced
4. ✅ **No Conflicts**: Local IDs never reach the backend API
5. ✅ **Transparent to User**: All sync happens in the background

## Testing Checklist

- [ ] Create customer offline → Verify local ID format
- [ ] Create invoice with offline customer → Verify stored with local customer ID
- [ ] Sync customer → Verify server ID received and stored
- [ ] Verify invoice customer ID updated to server ID
- [ ] Verify invoice syncs successfully after customer sync
- [ ] Test with multiple customers and invoices
- [ ] Test error handling when API sync fails

## Related Files
- `services/invoiceService.ts` - Invoice sync logic
- `services/customerService.ts` - Customer sync logic
- `services/localDatabase.ts` - Database operations
- `app/(tabs)/invoice/create.tsx` - Invoice creation UI
