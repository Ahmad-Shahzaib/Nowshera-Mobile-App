# Invoice Offline-First Implementation

## Overview
This document describes the implementation of the Invoice module with an offline-first architecture, allowing the app to work perfectly with or without internet connectivity.

## Architecture

### 1. Data Flow
```
API (Online) → Invoice Service → Local Database → UI
                     ↓
              (Offline mode)
                     ↓
         Local Database → UI
```

### 2. Key Components

#### **Types** (`types/invoice.ts`)
- `InvoiceApi`: Matches the API response structure
- `InvoiceApiResponse`: API response wrapper with pagination
- `Invoice`: App-level invoice type
- `InvoiceRow`: Local database row structure

#### **Local Database** (`services/localDatabase.ts`)
- **Table Schema**: `invoices` table with all necessary fields
- **Functions**:
  - `addInvoice()`: Create new invoice locally
  - `getInvoices()`: Retrieve all invoices
  - `getInvoiceById()`: Get single invoice
  - `updateInvoice()`: Update invoice fields
  - `deleteInvoice()`: Delete invoice
  - `getUnsyncedInvoices()`: Get invoices pending sync
  - `markInvoiceAsSynced()`: Mark invoice as synced
  - `clearAllInvoices()`: Clear all invoices (for refresh)
  - `upsertInvoice()`: Insert or update invoice

#### **Invoice Service** (`services/invoiceService.ts`)
Implements offline-first pattern:

```typescript
// 1. Get local data first (immediate response)
const localInvoices = await localDB.getInvoices();

// 2. If online, fetch from API and update local DB
if (online) {
  const apiInvoices = await axios.get('/invoices');
  await localDB.clearAllInvoices();
  for (const invoice of apiInvoices) {
    await localDB.upsertInvoice(invoice);
  }
}

// 3. Return local data
return localInvoices;
```

**Key Methods**:
- `getAllInvoices()`: Fetch all invoices (offline-first)
- `getInvoiceById()`: Get single invoice
- `createInvoice()`: Create invoice locally, sync when online
- `updateInvoice()`: Update invoice locally, sync when online
- `deleteInvoice()`: Delete invoice locally, sync when online
- `syncInvoices()`: Manually sync unsynced invoices

#### **Sync Service** (`services/syncService.ts`)
- `syncAll()`: Syncs both customers and invoices
- `syncUnsyncedInvoices()`: Syncs pending invoice changes to API

#### **UI Component** (`app/(tabs)/invoice.tsx`)
- Displays invoices from local database
- Pull-to-refresh functionality
- Real-time filtering and search
- Formatted amounts with currency
- Date formatting
- Status badges (Paid/Partially Paid/Unpaid)

## API Integration

### Endpoint
```
GET https://new.nosheraerp.softsuitetech.com/api/invoices
```

### Response Structure
```json
{
  "status": true,
  "pagination": {
    "total": 2108,
    "per_page": 20,
    "current_page": 1,
    "last_page": 106
  },
  "invoices": [
    {
      "id": 3543,
      "invoice_id": 760,
      "customer_id": 80,
      "customer_name": "Customer Name",
      "warehouse_id": 1,
      "warehouse_name": "Warehouse Name",
      "status": 3,
      "issue_date": "2025-12-04",
      "sub_total": 29424,
      "discount_total": 0,
      "tax_total": 0,
      "grand_total": 29424,
      "due_amount": 29424,
      "customer": {
        "id": 80,
        "name": "Customer Name"
      }
    }
  ]
}
```

### Status Mapping
- `1` → "Paid"
- `2` → "Partially Paid"
- `3` → "Unpaid"

## Features

### ✅ Implemented
1. **Offline-First Architecture**
   - Local SQLite database
   - Immediate data access without network
   - Background sync when online

2. **Data Fetching**
   - Pull-to-refresh
   - Automatic sync when connection restored
   - Cached data display

3. **Filtering & Search**
   - Filter by date
   - Filter by customer
   - Filter by status
   - Filter by warehouse/shop
   - Real-time search

4. **UI Features**
   - Loading states
   - Empty states
   - Pull-to-refresh
   - Formatted amounts
   - Date formatting
   - Status badges

5. **CRUD Operations**
   - View invoices
   - Delete invoices (with local DB update)
   - Edit navigation
   - Create navigation

### 🚧 To Be Implemented
1. **API Sync for Write Operations**
   - Currently, create/update/delete work locally
   - Need to implement server endpoints for:
     - `POST /invoices/store` (create)
     - `PUT /invoices/{id}` (update)
     - `DELETE /invoices/{id}` (delete)

2. **Pagination**
   - API returns paginated data (20 per page)
   - Implement load more functionality
   - Infinite scroll support

3. **Detailed Invoice View**
   - Show invoice items
   - Show payment history
   - Generate PDF

4. **Create/Edit Forms**
   - Invoice creation form
   - Invoice editing form
   - Customer selection
   - Item management

## Usage

### Loading Invoices
```typescript
import { invoiceService } from '@/services/invoiceService';

// Get all invoices (offline-first)
const invoices = await invoiceService.getAllInvoices();

// Get single invoice
const invoice = await invoiceService.getInvoiceById(id);
```

### Creating Invoice
```typescript
const newInvoice = await invoiceService.createInvoice({
  invoiceNo: '#INVO00123',
  customerId: '80',
  customerName: 'Customer Name',
  issueDate: '2025-12-09',
  grandTotal: '10000',
  dueAmount: '10000',
  status: 'Unpaid',
  // ... other fields
});
```

### Syncing Data
```typescript
// Automatic sync happens in background
// Manual sync:
await invoiceService.syncInvoices();
```

## Testing Offline Mode

1. **Test Offline Access**
   ```
   - Turn off internet
   - Open Invoice screen
   - Data should load from local database
   - All filtering/search should work
   ```

2. **Test Online Sync**
   ```
   - Turn on internet
   - Pull to refresh
   - New data should be fetched from API
   - Local database should be updated
   ```

3. **Test Create Offline**
   ```
   - Turn off internet
   - Create new invoice
   - Should save to local database
   - Turn on internet
   - Data should sync to server
   ```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY NOT NULL,
  serverId TEXT,
  invoiceNo TEXT,
  customerId TEXT,
  customerName TEXT,
  warehouseId TEXT,
  warehouseName TEXT,
  issueDate TEXT,
  dueDate TEXT,
  subTotal TEXT,
  discountTotal TEXT,
  taxTotal TEXT,
  grandTotal TEXT,
  dueAmount TEXT,
  status TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  synced INTEGER DEFAULT 0
);
```

## Best Practices

1. **Always use invoiceService** - Never directly access the API
2. **Handle loading states** - Show loaders while fetching
3. **Handle errors gracefully** - Display user-friendly messages
4. **Pull-to-refresh** - Allow users to manually refresh data
5. **Optimistic updates** - Update UI immediately, sync in background

## Troubleshooting

### Issue: No invoices showing
- Check if database is initialized
- Check network connection
- Check API endpoint URL
- Verify API token

### Issue: Invoices not syncing
- Check `getUnsyncedInvoices()` for pending items
- Verify network connectivity
- Check API endpoint implementation

### Issue: Duplicate invoices
- Use `upsertInvoice()` instead of `addInvoice()`
- Check serverId matching logic

## Future Enhancements

1. **Real-time sync** with WebSockets
2. **Conflict resolution** for offline edits
3. **Batch operations** for better performance
4. **Export functionality** (PDF, Excel)
5. **Advanced filtering** (date ranges, amount ranges)
6. **Sort options** (date, amount, customer)
7. **Invoice templates** for quick creation
8. **Payment tracking** within invoices
