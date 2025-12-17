# Testing Checklist for Offline-First Implementation

## ✅ Pre-Testing Setup

- [ ] App is installed and running
- [ ] You can toggle WiFi/Mobile Data on your device
- [ ] You have access to see console logs (Expo Developer Tools)

## 📱 Test Cases

### Test 1: Database Initialization
**Goal:** Verify local database creates properly

**Steps:**
1. Fresh install the app or clear data
2. Open the app
3. Check console for "[localDatabase] DB initialized"

**Expected:**
- ✅ No errors in console
- ✅ Customers screen loads
- ✅ Database tables created

**Status:** [ ]

---

### Test 2: Initial Data Fetch (Online)
**Goal:** Verify data fetches from API and caches locally

**Steps:**
1. Ensure internet is ON
2. Open Customers screen
3. Wait for data to load

**Expected:**
- ✅ Status shows "Online" (green dot)
- ✅ Customers load from API
- ✅ Data saved to local DB
- ✅ No errors

**Status:** [ ]

---

### Test 3: Offline Viewing
**Goal:** Verify cached data shows when offline

**Steps:**
1. (After Test 2) Turn OFF internet
2. Close and reopen app
3. Navigate to Customers screen

**Expected:**
- ✅ Status shows "Offline" (red dot)
- ✅ All customers still visible
- ✅ Data loads instantly (from cache)
- ✅ No error messages

**Status:** [ ]

---

### Test 4: Create Customer Offline
**Goal:** Verify customer creation works without internet

**Steps:**
1. Turn OFF internet
2. Tap "+ Add Customer"
3. Fill in customer details:
   - Name: "Test Customer Offline"
   - Contact: "0300-9999999"
   - Email: "test@offline.com"
4. Save customer

**Expected:**
- ✅ Customer saves successfully
- ✅ Customer appears in list immediately
- ✅ Status shows "Offline"
- ✅ Badge shows "1 pending"
- ✅ No error alert

**Status:** [ ]

---

### Test 5: Multiple Offline Operations
**Goal:** Verify multiple operations queue correctly

**Steps:**
1. Keep internet OFF
2. Create 2 more customers
3. Edit an existing customer
4. Check pending count

**Expected:**
- ✅ All operations work smoothly
- ✅ UI updates immediately
- ✅ Badge shows "3 pending" (or more)
- ✅ No crashes or errors

**Status:** [ ]

---

### Test 6: Auto-Sync on Reconnection
**Goal:** Verify automatic sync when internet returns

**Steps:**
1. (After Test 5) Turn ON internet
2. Wait 5 seconds
3. Observe status bar

**Expected:**
- ✅ Status changes to "Online"
- ✅ Syncing indicator appears briefly
- ✅ Badge updates to "0 pending"
- ✅ Console shows sync success messages
- ✅ No sync errors

**Status:** [ ]

---

### Test 7: Manual Sync Button
**Goal:** Verify manual sync works

**Steps:**
1. Turn OFF internet
2. Create 1 customer
3. Turn ON internet
4. Tap "🔄 Sync Now" button

**Expected:**
- ✅ Button is clickable
- ✅ Syncing indicator shows
- ✅ Success alert appears
- ✅ Badge updates to "0 pending"
- ✅ Button disappears after sync

**Status:** [ ]

---

### Test 8: Pull to Refresh
**Goal:** Verify pull-to-refresh triggers sync

**Steps:**
1. Create customer offline (internet OFF)
2. Turn ON internet
3. Pull down to refresh the list

**Expected:**
- ✅ Refresh spinner shows
- ✅ Data refreshes from API
- ✅ Pending items sync
- ✅ Badge updates to "0 pending"

**Status:** [ ]

---

### Test 9: Edit Customer Offline
**Goal:** Verify editing works offline

**Steps:**
1. Turn OFF internet
2. Tap any customer to view details
3. Tap edit button
4. Change customer name
5. Save changes

**Expected:**
- ✅ Changes save successfully
- ✅ Updated name shows in list
- ✅ Badge shows "1 pending"
- ✅ Turn ON internet and verify sync

**Status:** [ ]

---

### Test 10: Delete Customer Offline
**Goal:** Verify deletion works offline

**Steps:**
1. Turn OFF internet
2. Tap delete (🗑️) on any customer
3. Confirm deletion

**Expected:**
- ✅ Customer deleted immediately
- ✅ Customer removed from list
- ✅ Success alert shows
- ✅ No errors

**Status:** [ ]

---

### Test 11: Verify Server Sync
**Goal:** Ensure offline changes actually reach server

**Steps:**
1. Create customer offline
2. Turn ON internet
3. Wait for auto-sync
4. Open Nowshera-Trader web interface
5. Check if customer exists

**Expected:**
- ✅ Customer appears on server
- ✅ All details match
- ✅ Has proper server ID

**Status:** [ ]

---

### Test 12: Network Loss During Operation
**Goal:** Handle network loss gracefully

**Steps:**
1. Start creating customer (internet ON)
2. Turn OFF internet mid-save
3. Complete and save

**Expected:**
- ✅ Save completes successfully
- ✅ Marked as unsynced
- ✅ Will sync when online

**Status:** [ ]

---

### Test 13: Large Dataset
**Goal:** Verify performance with many customers

**Steps:**
1. (With internet) Load 50+ customers
2. Turn OFF internet
3. Scroll through list
4. Search/filter customers
5. Open customer details

**Expected:**
- ✅ Smooth scrolling
- ✅ Fast loading
- ✅ No lag or crashes
- ✅ All features work

**Status:** [ ]

---

### Test 14: App Restart Offline
**Goal:** Verify data persists across restarts

**Steps:**
1. Create 3 customers offline
2. Close app completely
3. Reopen app (still offline)

**Expected:**
- ✅ All 3 customers still visible
- ✅ Badge shows "3 pending"
- ✅ Data not lost
- ✅ Status shows "Offline"

**Status:** [ ]

---

### Test 15: Sync Error Handling
**Goal:** Verify error handling during sync

**Steps:**
1. Create customer with invalid data offline
2. Turn ON internet
3. Wait for sync attempt

**Expected:**
- ✅ Error logged in console
- ✅ App doesn't crash
- ✅ Other valid items still sync
- ✅ Failed item remains unsynced

**Status:** [ ]

---

## 📊 Test Results Summary

### Total Tests: 15
- **Passed:** ___/15
- **Failed:** ___/15
- **Skipped:** ___/15

### Critical Issues Found:
_List any critical issues here_

---

### Non-Critical Issues:
_List any minor issues here_

---

### Notes:
_Any additional observations_

---

## ✅ Sign-Off

**Tested By:** ________________
**Date:** ________________
**Build/Version:** ________________

**Overall Status:** [ ] Pass [ ] Fail [ ] Needs Review

---

## 🐛 Bug Report Template

If you find any issues:

```
**Bug Title:** 
**Severity:** Critical / High / Medium / Low
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**

**Actual Result:**

**Screenshots/Logs:**

**Device Info:**
- OS: 
- Version: 
```

---

## 💡 Tips for Testing

1. **Clear Console:** Clear console logs between tests for clarity
2. **Airplane Mode:** Use airplane mode to simulate offline
3. **Network Tab:** Monitor API calls in developer tools
4. **Database Check:** Use SQLite browser to inspect local data
5. **Take Notes:** Document any unexpected behavior

---

## 🎯 Success Criteria

All tests should pass with:
- ✅ No crashes
- ✅ No data loss
- ✅ Smooth user experience
- ✅ Clear feedback to user
- ✅ Successful syncing

---

**Happy Testing! 🚀**
