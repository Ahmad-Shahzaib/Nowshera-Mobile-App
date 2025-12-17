# Offline-First Architecture Documentation

## Overview
This application now implements a complete offline-first architecture, allowing users to work seamlessly with or without an internet connection. All customer operations (create, read, update, delete) are available offline and automatically sync when the connection is restored.

## Architecture Components

### 1. Local Database (`services/localDatabase.ts`)
- **Technology**: SQLite (expo-sqlite)
- **Tables**: 
  - `customers` - Stores customer data locally
  - `invoices` - Stores invoice data locally (future)
  
**Key Functions:**
- `initDB()` - Initialize database and create tables
- `addCustomer()` - Add new customer to local DB
- `getCustomers()` - Get all customers from local DB
- `getCustomerById()` - Get single customer by ID or serverID
- `updateCustomer()` - Update customer in local DB
- `deleteCustomer()` - Delete customer from local DB
- `upsertCustomer()` - Insert or update customer (used for syncing)
- `getUnsynced()` - Get all unsynced customers
- `markAsSynced()` - Mark customer as synced with server
- `clearAllCustomers()` - Clear all customers (used when refreshing from API)

**Data Structure:**
Each customer row includes:
- `id` - Local unique ID (UUID format: `local_timestamp`)
- `serverId` - Server-side ID (when synced)
- `synced` - Flag (0 = unsynced, 1 = synced)
- All customer fields (name, contact, email, etc.)

### 2. Customer Service (`services/customerService.ts`)
Implements offline-first strategy for all CRUD operations:

#### **getAllCustomers()**
1. First, return local data immediately (fast response)
2. If online, fetch fresh data from API
3. Update local cache with API data
4. If API fails, continue using local data

#### **getCustomerById(id)**
1. Try to fetch from API if online
2. Cache API response locally
3. If offline or API fails, use local data

#### **createCustomer(data)**
1. Try to create on server if online
2. Save to local DB with `synced=1` if successful
3. If offline or API fails, save locally with `synced=0`
4. Will sync later when connection is restored

#### **updateCustomer(id, data)**
1. Try to update on server if online
2. Update local DB with `synced=1` if successful
3. If offline or API fails, update locally with `synced=0`
4. Will sync later when connection is restored

#### **deleteCustomer(id)**
1. Try to delete from server if online
2. Delete from local DB if successful
3. If offline, delete from local DB immediately
4. (Note: Production apps might mark as "pending deletion" instead)

#### **Additional Functions:**
- `getUnsyncedCount()` - Get count of unsynced customers
- `syncUnsyncedCustomers()` - Manually sync all unsynced data

### 3. Sync Service (`services/syncService.ts`)
Handles synchronization of local data to the server.

**Key Functions:**
- `syncAll()` - Sync all unsynced data
- `syncUnsyncedCustomers()` - Sync only customer data
- `isOnline()` - Check network connectivity

**Sync Process:**
1. Check if device is online
2. Get all unsynced records from local DB
3. For each unsynced record:
   - POST to server API
   - If successful, mark as synced with server ID
   - If failed, log error and continue
4. Return results with sync count and errors

### 4. Sync Context (`context/SyncContext.tsx`)
React Context Provider for managing sync state globally.

**Provides:**
- `ready` - Database initialization status
- `customers` - Local customer list
- `unsyncedCount` - Number of unsynced customers
- `isSyncing` - Current sync operation status
- `lastSyncTime` - Timestamp of last successful sync
- `isOnline` - Network connectivity status
- `syncNow()` - Trigger manual sync
- `refresh()` - Refresh local data from DB

**Auto-Sync:**
- Automatically syncs when internet connection is restored
- Monitors network state changes
- Prevents duplicate sync operations

### 5. UI Layer (`app/(tabs)/customer.tsx`)
Displays sync status and provides user controls.

**Features:**
- **Status Bar**: Shows online/offline status
- **Unsynced Badge**: Displays count of pending items
- **Sync Button**: Manual sync trigger
- **Pull-to-Refresh**: Refreshes data and triggers sync
- **Loading States**: Shows syncing progress

## Data Flow

### Creating a Customer (Offline)
```
User Input → customerService.createCustomer()
           ↓
    [Check Network]
           ↓
    [Offline Detected]
           ↓
    Save to Local DB (synced=0)
           ↓
    Update UI Immediately
           ↓
    [Wait for Network]
           ↓
    Auto-Sync Triggered
           ↓
    POST to API
           ↓
    Mark as Synced (synced=1, serverId=123)
```

### Reading Customers (Offline-First)
```
User Opens Screen → customerService.getAllCustomers()
                  ↓
           Get Local Data (Fast!)
                  ↓
           Return to UI Immediately
                  ↓
           [Check Network in Background]
                  ↓
           If Online: Fetch from API
                  ↓
           Update Local Cache
                  ↓
           Refresh UI with Fresh Data
```

### Syncing Process
```
Network Restored → SyncContext Detects Change
                 ↓
          Check unsyncedCount > 0
                 ↓
          Call syncService.syncAll()
                 ↓
          Get Unsynced Records
                 ↓
          For Each Record:
            - POST to API
            - Get Server ID
            - Mark as Synced
                 ↓
          Update UI with Results
```

## Benefits

### 1. **Always Available**
- App works without internet
- No loading delays for local data
- Users can work anywhere

### 2. **Fast Performance**
- Local data loads instantly
- No waiting for API responses
- Smooth user experience

### 3. **Automatic Sync**
- No manual intervention needed
- Syncs when connection restored
- Visual feedback for pending items

### 4. **Data Integrity**
- All changes tracked locally
- No data loss
- Retry mechanism for failed syncs

### 5. **Transparent to Users**
- Clear online/offline status
- Unsynced count visible
- Manual sync option available

## Usage Examples

### Using the Service
```typescript
import { customerService } from '@/services/customerService';

// Works offline or online automatically
const customers = await customerService.getAllCustomers();

// Create customer (saved locally if offline)
const newCustomer = await customerService.createCustomer({
  name: 'John Doe',
  contact: '0300-1234567',
  email: 'john@example.com'
});

// Check sync status
const unsyncedCount = await customerService.getUnsyncedCount();

// Manual sync
const result = await customerService.syncUnsyncedCustomers();
console.log(`Synced ${result.syncedCount} items`);
```

### Using the Context
```typescript
import { useSync } from '@/context/SyncContext';

function MyComponent() {
  const { 
    isOnline, 
    unsyncedCount, 
    isSyncing, 
    syncNow 
  } = useSync();

  return (
    <View>
      <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
      <Text>Pending: {unsyncedCount}</Text>
      {unsyncedCount > 0 && (
        <Button 
          title="Sync Now" 
          onPress={syncNow}
          disabled={isSyncing || !isOnline}
        />
      )}
    </View>
  );
}
```

## Testing Scenarios

### Test 1: Create Customer Offline
1. Turn off internet/WiFi
2. Create a new customer
3. Verify it appears in the list immediately
4. Check status bar shows "Offline" and "1 pending"
5. Turn on internet
6. Wait for auto-sync or tap "Sync Now"
7. Verify status shows "Online" and "0 pending"

### Test 2: Update Customer Offline
1. Turn off internet
2. Edit an existing customer
3. Save changes
4. Verify changes appear immediately
5. Turn on internet
6. Sync should update server automatically

### Test 3: View Customers Offline
1. Open app with internet
2. Let customers load
3. Turn off internet
4. Navigate away and back to customers
5. All customers should still be visible
6. You can still view, edit, create, delete

### Test 4: Delete Customer Offline
1. Turn off internet
2. Delete a customer
3. Customer removed immediately
4. Turn on internet
5. Deletion syncs to server

### Test 5: Auto-Sync on Connection
1. Turn off internet
2. Create 3 customers
3. Status shows "3 pending"
4. Turn on internet
5. Watch auto-sync happen
6. All 3 customers sync to server

## Troubleshooting

### Sync Not Happening
- Check network connectivity
- Look for sync errors in console
- Verify API endpoint is correct
- Check authentication token

### Duplicate Customers
- This can happen if you create customers offline and API returns different IDs
- The `upsertCustomer` function should handle this
- Check `serverId` mapping

### Data Not Showing
- Verify database is initialized
- Check console for SQLite errors
- Try clearing app data and reinstalling

## Future Enhancements

1. **Conflict Resolution**: Handle cases where same customer is edited on multiple devices
2. **Deletion Queue**: Mark items for deletion instead of immediate delete
3. **Invoice Sync**: Extend to invoices and other entities
4. **Batch Sync**: Sync multiple items in single API call
5. **Sync History**: Track sync operations with timestamps
6. **Selective Sync**: Allow users to choose what to sync
7. **Background Sync**: Use background tasks for syncing

## API Endpoints Used

- `GET /customers` - Fetch all customers
- `GET /customers/{id}/edit` - Get single customer
- `POST /customers/store` - Create customer
- `POST /customers/{id}/update` - Update customer
- `DELETE /customer/{id}/destroy` - Delete customer

## Database Schema

### customers Table
```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY NOT NULL,
  serverId TEXT,
  name TEXT,
  contact TEXT,
  email TEXT,
  taxNumber TEXT,
  openingBalance TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  zip TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  synced INTEGER DEFAULT 0
);
```

## Conclusion

This offline-first architecture provides a robust, user-friendly experience that works seamlessly with or without internet connectivity. The implementation ensures data integrity, provides clear feedback, and automatically synchronizes when connectivity is restored.
