# Product Sync Implementation

## Overview
Products are now synced from the API and stored locally in SQLite for offline-first functionality.

## API Endpoint
```
GET https://new.nosheraerp.softsuitetech.com/api/invoice/products
```

## Current Issue
The API is returning 404. Please verify:

1. **API Endpoint is accessible**: Test the URL in Postman/browser
2. **Authentication**: Check if the endpoint requires authentication headers
3. **Correct Path**: Verify the path is `/api/invoice/products` not something else

## Detailed Error Logs
The app now logs:
- Full API endpoint URL
- Response status code
- Response data structure
- Error details including status and response data

Check the console for these logs when the app starts.

## How It Works

### 1. Database Schema
A `products` table is created with:
- `id` (INTEGER PRIMARY KEY)
- `label` (TEXT) - Product name in Urdu
- `syncedAt` (INTEGER) - Timestamp of last sync

### 2. Product Service (`services/productService.ts`)
- `syncProducts()` - Fetches products from API and stores in SQLite
- `searchProducts(searchTerm)` - Searches products by label
- `getLocalProducts()` - Gets all products from local DB
- `needsSync()` - Checks if sync is needed (empty DB or >24 hours old)

### 3. Sync on App Start
Products are automatically synced when the app starts if:
- No products exist in the database, OR
- Products are older than 24 hours

### 4. Invoice Creation Form
The product name field now has autocomplete:
- Type to search products
- Shows matching suggestions in a dropdown
- Select from dropdown or continue typing
- Works offline using cached products

## Testing Steps

### 1. Fix API Endpoint
First, verify the API works:
```bash
curl -X GET "https://new.nosheraerp.softsuitetech.com/api/invoice/products" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 2. Check if Authentication is Required
If the endpoint needs authentication, update `lib/axios.ts` to include the token.

### 3. Manual Sync Test
Add this to test product sync manually:
```typescript
import { productService } from '@/services/productService';

// Call this from a button
const testSync = async () => {
  const result = await productService.syncProducts();
  console.log('Sync result:', result);
};
```

### 4. Check Console Logs
Look for these logs:
```
[SyncContext] Syncing products from server...
Fetching products from server...
API Endpoint: /api/invoice/products
Response status: 200
Received XXX products from server
```

## Fallback Behavior
- If sync fails, the app uses cached products
- If no cached products, a warning is shown but app continues to work
- Users can manually type product names even without sync

## Next Steps

1. **Fix 404 Error**: 
   - Verify the API endpoint path
   - Check if authentication is required
   - Test the endpoint directly

2. **Alternative Solutions** (if API changes):
   - Update `PRODUCTS_ENDPOINT` in `productService.ts`
   - Add authentication headers if needed
   - Modify response parsing if data structure is different

3. **Manual Product Entry**:
   - Even without sync, users can type product names
   - Consider adding a manual product management screen

## Files Modified

1. `/types/product.ts` - Product type definitions
2. `/services/productService.ts` - Product service with sync logic
3. `/services/localDatabase.ts` - Added products table
4. `/context/SyncContext.tsx` - Auto-sync on app start
5. `/app/(tabs)/invoice/create.tsx` - Product autocomplete in form
