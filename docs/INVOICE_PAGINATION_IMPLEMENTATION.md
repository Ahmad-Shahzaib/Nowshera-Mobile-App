# Invoice Pagination Implementation

## Overview
Is implementation mein invoice listing ko pagination ke saath implement kiya gaya hai, jahan:
- **Online mode**: Backend se paginated invoices fetch hoti hain
- **Offline mode**: Sirf unsynced (local) invoices display hoti hain

## Changes Made

### 1. Invoice Service (`services/invoiceService.ts`)

#### New Method: `getInvoices()`
```typescript
async getInvoices(page: number = 1, perPage: number = 10): Promise<{
  invoices: Invoice[];
  total: number;
  currentPage: number;
  totalPages: number;
}>
```

**Functionality:**
- **Online hai to**: Backend API se pagination ke saath invoices fetch karta hai
  - URL: `/invoices?page={page}&per_page={perPage}`
  - Backend se pagination info (total, current_page, last_page) milti hai
  - Fresh data directly return hota hai (local DB mein save nahi hota pagination mein)

- **Offline hai to**: Sirf unsynced invoices return karta hai
  - `localDB.getUnsyncedInvoices()` se unsynced invoices milti hain
  - Ye wo invoices hain jo aapne bina internet ke add ki hain
  - Pagination disabled hoti hai offline mode mein

### 2. Invoice Listing Page (`app/(tabs)/invoice.tsx`)

#### New Features:

1. **Network Status Detection**
   - `useNetwork()` hook ka use karke online/offline status detect karta hai

2. **Pagination State**
   ```typescript
   const [currentPage, setCurrentPage] = useState(1);
   const [totalPages, setTotalPages] = useState(1);
   const [totalInvoices, setTotalInvoices] = useState(0);
   const [loadingMore, setLoadingMore] = useState(false);
   ```

3. **Smart Loading Logic**
   ```typescript
   const loadInvoices = useCallback(async (page: number = 1, append: boolean = false) => {
     if (isConnected) {
       // Online: Backend se fetch karo pagination ke saath
       const result = await invoiceService.getInvoices(page, perPage);
       if (append) {
         setInvoices(prev => [...prev, ...result.invoices]); // Append karo
       } else {
         setInvoices(result.invoices); // Replace karo
       }
     } else {
       // Offline: Sirf unsynced invoices load karo
       const result = await invoiceService.getInvoices(1, 100);
       setInvoices(result.invoices);
     }
   }, [isConnected, perPage]);
   ```

4. **Offline Banner**
   - Jab offline ho to ek banner show hota hai:
   ```
   🌐 Offline mode - Showing X unsynced invoices
   ```

5. **Infinite Scroll + Load More Button**
   - FlatList mein `onEndReached` se automatic pagination
   - Footer mein "Load More" button bhi available hai
   - Loading state ke saath proper feedback

6. **Footer States**
   ```typescript
   ListFooterComponent={
     loadingMore ? (
       // Loading spinner
     ) : isConnected && currentPage < totalPages ? (
       // Load More button
     ) : isConnected && totalInvoices > 0 ? (
       // "Showing all X invoices" message
     ) : null
   }
   ```

## User Experience

### Online Mode (Internet Connected)
1. App open karte hi backend se pehli page ki invoices load hoti hain (default 10 items)
2. Scroll karte hue neeche pohanchne par automatically next page load hoti hai
3. Ya manually "Load More" button press kar sakte hain
4. Total count aur current page ka indication milta hai

### Offline Mode (No Internet)
1. Sirf wo invoices show hoti hain jo aapne offline add ki hain aur abhi sync nahi hui
2. Ek orange banner display hota hai: "Offline mode - Showing X unsynced invoices"
3. Pagination disabled hai kyunki ye local data hai
4. Jaise hi internet wapas aayega, refresh karne par backend data load hoga

## API Requirements

Backend API ko ye support karna chahiye:
```
GET /invoices?page=1&per_page=10
```

**Response Format:**
```json
{
  "status": true,
  "pagination": {
    "total": 100,
    "per_page": 10,
    "current_page": 1,
    "last_page": 10
  },
  "invoices": [...]
}
```

## Testing Checklist

### Online Mode
- [ ] First page load hoti hai correctly
- [ ] Scroll karne par next pages load hoti hain
- [ ] "Load More" button click se next page load hoti hai
- [ ] Last page par "Showing all X invoices" message show hota hai
- [ ] Pull to refresh se pehli page par wapas jaata hai

### Offline Mode
- [ ] Sirf unsynced invoices show hoti hain
- [ ] Offline banner display hota hai
- [ ] Pagination controls hidden hain
- [ ] Empty state message correct hai: "No unsynced invoices"

### Transition
- [ ] Online se offline jane par unsynced invoices show hoti hain
- [ ] Offline se online jane par backend data load hota hai

## Benefits

1. **Performance**: Sirf zaroorat ki data load hoti hai, pura list nahi
2. **Offline Support**: Bina internet ke bhi apni local invoices dekh sakte hain
3. **User Feedback**: Clear indication ki online/offline kaunsa mode active hai
4. **Scalability**: Thousands of invoices handle kar sakta hai efficiently

## Future Enhancements

1. Search aur filters ke saath pagination
2. Custom page size selection
3. Jump to specific page
4. Cache backend responses for faster loading
5. Optimistic UI updates
