import { getAxiosInstance } from '@/lib/axios';
import localDB, { BankAccountRow } from './localDatabase';

const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

interface BankAccountAPIResponse {
  data: Array<{
    id: number;
    warehouse_id: number;
    holder_name: string;
    bank_name: string;
    account_number: string;
    chart_account_id: number;
    opening_balance: number;
    contact_number: string;
    bank_address: string;
    created_by: number;
    shop_id: number | null;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * Check if bank accounts need to be synced from server
 */
export async function needsSync(): Promise<boolean> {
  try {
    const allAccounts = await localDB.getBankAccounts();
    if (allAccounts.length === 0) return true;
    
    // Check if any account has syncedAt timestamp
    const hasTimestamp = allAccounts.some(account => account.syncedAt);
    if (!hasTimestamp) return true;
    
    // Check if oldest sync is older than SYNC_INTERVAL
    const oldestSync = Math.min(...allAccounts.map(a => a.syncedAt || 0));
    const now = Date.now();
    return (now - oldestSync) > SYNC_INTERVAL;
  } catch (error) {
    console.error('[bankAccountService] needsSync failed:', error);
    return true;
  }
}

/**
 * Sync bank accounts from server to local database
 */
export async function syncBankAccounts(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const axiosInstance = getAxiosInstance();
    console.log('[bankAccountService] Fetching bank accounts from /invoice/bank-accounts');
    const response = await axiosInstance.get<BankAccountAPIResponse>('/invoice/bank-accounts');
    
    if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
      console.error('[bankAccountService] Invalid response format:', response.data);
      return { success: false, count: 0, error: 'Invalid response from server' };
    }
    
    const bankAccounts = response.data.data;
    console.log(`[bankAccountService] Received ${bankAccounts.length} bank accounts from server`);

    // Log a small sample to help debugging payload format
    const sample = bankAccounts.slice(0, 5).map(b => ({ id: b.id, bank_name: b.bank_name, account_number: b.account_number }));
    console.log('[bankAccountService] Sample accounts:', sample);
    
    const syncedAt = Date.now();
    await localDB.saveBankAccounts(bankAccounts, syncedAt);
    
    console.log(`[bankAccountService] Successfully synced ${bankAccounts.length} bank accounts`);
    return { success: true, count: bankAccounts.length };
  } catch (error: any) {
    console.error('[bankAccountService] syncBankAccounts failed:', error);
    return { 
      success: false, 
      count: 0, 
      error: error?.message || 'Failed to sync bank accounts' 
    };
  }
}

/**
 * Get all bank accounts from local database
 */
export async function getBankAccounts(): Promise<BankAccountRow[]> {
  try {
    return await localDB.getBankAccounts();
  } catch (error) {
    console.error('[bankAccountService] getBankAccounts failed:', error);
    return [];
  }
}

/**
 * Get bank accounts filtered by warehouse ID
 */
export async function getBankAccountsByWarehouse(warehouseId: number): Promise<BankAccountRow[]> {
  try {
    return await localDB.getBankAccounts(warehouseId);
  } catch (error) {
    console.error('[bankAccountService] getBankAccountsByWarehouse failed:', error);
    return [];
  }
}

/**
 * Get count of bank accounts in database
 */
export async function getBankAccountCount(): Promise<number> {
  try {
    const accounts = await localDB.getBankAccounts();
    return accounts.length;
  } catch (error) {
    console.error('[bankAccountService] getBankAccountCount failed:', error);
    return 0;
  }
}

export const bankAccountService = {
  needsSync,
  syncBankAccounts,
  getBankAccounts,
  getBankAccountsByWarehouse,
  getBankAccountCount,
};
