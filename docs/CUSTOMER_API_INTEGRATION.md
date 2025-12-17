# Customer Module - API Integration

## Overview
The customer module has been updated to fetch data dynamically from the API instead of using hardcoded data. This implementation is production-ready with proper error handling, loading states, and pull-to-refresh functionality.

## Changes Made

### 1. **Type Definitions** (`types/customer.ts`)
- Created `Customer` interface matching the API response structure
- Created `CustomerResponse` interface for API responses
- All 33+ fields from the API are properly typed

### 2. **Customer Service** (`services/customerService.ts`)
- `getAllCustomers()`: Fetch all customers
- `getCustomerById(id)`: Fetch a single customer
- `createCustomer(data)`: Create a new customer
- `updateCustomer(id, data)`: Update an existing customer
- `deleteCustomer(id)`: Delete a customer
- Proper error handling with descriptive messages
- Uses the configured axios instance with authentication

### 3. **Customer Component** (`app/(tabs)/customer.tsx`)
- **Dynamic Data**: Fetches customers from API on mount
- **Loading States**: Shows spinner while loading
- **Error Handling**: Displays error messages with retry button
- **Pull-to-Refresh**: Swipe down to refresh the list
- **Pagination**: Loads 10 customers at a time, infinite scroll
- **Delete Functionality**: Confirmation dialog before deletion
- **Proper Navigation**: Customer ID passed correctly to detail/edit screens

## Features

### Loading State
- Displays a centered spinner with "Loading customers..." text
- Shows while initial data is being fetched

### Error Handling
- If API fails, shows error message with retry button
- User-friendly error messages
- Console logging for debugging

### Pull to Refresh
- Swipe down on the list to refresh data
- Visual indicator while refreshing
- Resets pagination to show first page

### Delete Customer
- Tap trash icon to delete
- Shows confirmation dialog with customer name
- Success/error alerts after operation
- Auto-refreshes list after successful deletion

### Pagination
- Loads 10 customers initially
- Loads more as user scrolls down
- Shows loading indicator at bottom while loading more

## API Configuration

The API base URL is configured in `.env`:
```
NEXT_PUBLIC_BASE_URL=https://new.nosheraerp.softsuitetech.com
```

The axios instance automatically:
- Appends `/api` to all requests
- Adds authentication token from AsyncStorage
- Sets proper headers

## Customer Data Fields

Each customer object contains:
- **Identity**: id, customer_id, chart_of_accounts_id
- **Basic Info**: name, email, contact, type
- **Billing**: billing_name, billing_address, billing_city, billing_country, billing_phone
- **Shipping**: shipping_name, shipping_address, shipping_city, shipping_country, shipping_phone
- **Financial**: balance
- **Metadata**: created_at, updated_at, is_active

## Usage Example

```typescript
// The component automatically fetches data on mount
// Manual refresh:
onRefresh()

// Delete customer:
handleDeleteCustomer(customerId, customerName)
```

## Testing

To test the implementation:

1. **Start the app**:
   ```bash
   npm start
   # or
   expo start
   ```

2. **Navigate to Customers tab**
   - Should see loading spinner initially
   - Then list of customers from API

3. **Test Pull-to-Refresh**
   - Swipe down on the list
   - Should show refresh indicator

4. **Test Pagination**
   - Scroll to bottom
   - Should load more customers

5. **Test Delete**
   - Tap trash icon
   - Confirm deletion
   - Customer should be removed

## Error Scenarios Handled

1. **Network Error**: Shows "Failed to load customers" with retry
2. **API Error**: Shows specific error message from API
3. **No Token**: Request fails, shows authentication error
4. **Timeout**: 10-second timeout on all requests

## Next Steps

Consider implementing:
1. Search/filter functionality
2. Sort options (by name, balance, date)
3. Offline caching with AsyncStorage
4. Optimistic updates for better UX
5. Customer detail view updates
6. Create/Edit customer form updates

## Notes

- All customer IDs are displayed as `#CUST00001` format (8 digits with leading zeros)
- Balance is shown with "Rs." suffix
- View (eye icon) and Edit (pencil icon) both navigate to detail page (update as needed)
- The component is fully typed with TypeScript for better IDE support
