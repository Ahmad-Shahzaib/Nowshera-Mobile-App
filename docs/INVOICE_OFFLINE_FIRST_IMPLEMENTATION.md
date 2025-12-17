# Invoice Offline-First Implementation

## Overview
This document describes the implementation of an offline-first approach for invoice creation in the Nowshera Mobile App. The system allows users to create invoices even when offline, storing them locally in SQLite, and automatically syncing them to the API when internet connectivity is restored.

## Architecture

### 1. Database Schema

#### Invoice Table (Enhanced)
Added new fields to the invoices table:
- `customerType` - Type of customer (Customer, Dealer, Walk-in)
- `categoryId` - Product category ID
- `refNumber` - Reference number
- `deliveryStatus` - Delivery status (Pending, Delivered, etc.)

#### New Tables

**invoice_items** - Stores invoice line items
```sql
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL,
  productId INTEGER NOT NULL,
  productName TEXT,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  description TEXT,
  shopId INTEGER,
  createdAt TEXT,
  FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
);
```

**invoice_payments** - Stores payment details
```sql
CREATE TABLE invoice_payments (
  id TEXT PRIMARY KEY,
  invoiceId TEXT NOT NULL,
  amount REAL NOT NULL,
  accountId INTEGER NOT NULL,
  accountName TEXT,
  paymentMethod INTEGER,
  date TEXT NOT NULL,
  reference TEXT,
  createdAt TEXT,
  FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
);
```

### 2. API Integration

#### Endpoint
```
POST https://new.nosheraerp.softsuitetech.com/api/invoice/store
```

#### Payload Format
```json
{
  "customer_type": "Customer",
  "customer_id": 5,
  "issue_date": "2023-11-15",
  "due_date": "2023-12-15",
  "category_id": 2,
  "warehouse_id": 1,
  "ref_number": "abc",
  "delivery_status": "Delivered",
  "items": [
    {
      "id": 7,
      "quantity": 2,
      "description": "اسکِن کیئر میں سن اسکرین",
      "price": 35.00,
      "shop_id": 1
    }
  ],
  "payments": [
    {
      "amount": 150.00,
      "account_id": 1,
      "payment_method": 2,
      "date": "2023-11-15",
      "reference": "PAY-001"
    }
  ]
}
```

### 3. Implementation Flow

#### Invoice Creation (Offline-First)

1. **User fills out invoice form** (`app/(tabs)/invoice/create.tsx`)
   - Select customer/dealer or enter walk-in customer details
   - Select warehouse/shop
   - Select category
   - Add products with quantity, price, and discount
   - Add payment details (optional)

2. **handleCreate() function**
   - Validates all required fields
   - Prepares invoice data with items and payments
   - Calls `invoiceService.createInvoice()`

3. **invoiceService.createInvoice()** (Offline-First)
   - **Step 1**: Saves invoice to local SQLite database
     - Insert into `invoices` table with `synced = 0`
     - Insert items into `invoice_items` table
     - Insert payments into `invoice_payments` table
   
   - **Step 2**: Check internet connectivity
     - If ONLINE: Attempt to sync immediately to API
       - On success: Mark invoice as synced (`synced = 1`) and store `serverId`
       - On failure: Log error, invoice remains unsynced for later
     - If OFFLINE: Invoice stays unsynced (`synced = 0`)

4. **User sees immediate feedback**
   - Invoice is saved successfully
   - User can continue working offline

#### Background Sync

**syncService.syncUnsyncedInvoices()** runs periodically:
1. Checks for internet connectivity
2. Queries all unsynced invoices (`synced = 0`)
3. For each unsynced invoice:
   - Retrieves related items and payments
   - Prepares API payload
   - Posts to `/invoice/store` endpoint
   - On success: Marks as synced with `serverId`
   - On failure: Logs error and retries later

### 4. Key Files Modified

#### `/services/localDatabase.ts`
- Added `InvoiceItemRow` and `InvoicePaymentRow` types
- Created `invoice_items` and `invoice_payments` tables
- Added CRUD functions:
  - `addInvoiceItem()`
  - `getInvoiceItems()`
  - `deleteInvoiceItems()`
  - `addInvoicePayment()`
  - `getInvoicePayments()`
  - `deleteInvoicePayments()`

#### `/services/invoiceService.ts`
- Enhanced `createInvoice()` method:
  - Accepts invoice data with items and payments
  - Saves to local database first
  - Attempts API sync if online
  - Returns result immediately

#### `/services/syncService.ts`
- Implemented `syncUnsyncedInvoices()`:
  - Fetches unsynced invoices with items and payments
  - Formats payload for API
  - Handles sync errors gracefully
  - Marks successfully synced invoices

#### `/app/(tabs)/invoice/create.tsx`
- Imported `invoiceService`
- Implemented full `handleCreate()` function:
  - Comprehensive validation
  - Data preparation and formatting
  - Integration with offline-first service
  - User feedback

#### `/types/invoice.ts`
- Extended `Invoice` interface with new fields:
  - `customerType`
  - `categoryId`
  - `refNumber`
  - `deliveryStatus`

### 5. Benefits

✅ **Offline Capability**: Users can create invoices without internet
✅ **Data Integrity**: All data saved locally first, no data loss
✅ **Automatic Sync**: Background sync when connectivity restored
✅ **User Experience**: Immediate feedback, no waiting for API
✅ **Resilience**: Handles network failures gracefully
✅ **Complete Data**: Items and payments stored with invoices

### 6. Testing Checklist

- [ ] Create invoice while online - verify API sync
- [ ] Create invoice while offline - verify local storage
- [ ] Toggle airplane mode - verify offline detection
- [ ] Restore connectivity - verify background sync
- [ ] Check SQLite tables for invoice, items, and payments
- [ ] Verify API payload format matches backend expectations
- [ ] Test with multiple items and payments
- [ ] Test walk-in customer creation
- [ ] Test dealer invoice creation
- [ ] Verify error handling for API failures

### 7. Future Enhancements

- **Conflict Resolution**: Handle cases where local and server data diverge
- **Batch Sync**: Optimize syncing multiple invoices at once
- **Sync Status UI**: Show users which invoices are synced/pending
- **Retry Logic**: Exponential backoff for failed syncs
- **Partial Sync**: Sync items and payments separately if needed

## Troubleshooting

### Invoice not syncing
1. Check network connectivity with `useNetwork` hook
2. Verify API endpoint is accessible
3. Check console logs for API errors
4. Verify `synced` flag in database

### Data not showing
1. Run `initDB()` to ensure tables created
2. Check SQLite database with database inspector
3. Verify foreign key constraints

### API errors
1. Check payload format matches backend expectations
2. Verify authentication token is valid
3. Check API response in console logs
4. Verify product IDs and account IDs exist in backend

## Conclusion

This implementation provides a robust offline-first solution for invoice creation, ensuring users can work seamlessly regardless of connectivity status, while maintaining data integrity and automatic synchronization.
