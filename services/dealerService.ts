import { getAxiosInstance } from '@/lib/axios';
import type { Dealer, DealerResponse } from '@/types/dealer';
import localDB from './localDatabase';

const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const LAST_SYNC_KEY = 'dealers_last_sync';

/**
 * Dealer Service - Offline-first approach
 * Syncs dealers from server and stores in SQLite for offline access
 */
export const dealerService = {
  /**
   * Check if dealers need to be synced (first launch or after 24 hours)
   */
  async needsSync(): Promise<boolean> {
    try {
      const lastSync = await this.getLastSyncTime();
      if (!lastSync) return true;
      
      const now = Date.now();
      return (now - lastSync) > SYNC_INTERVAL;
    } catch (error) {
      console.error('[dealerService] Error checking sync status:', error);
      return true; // Sync on error to be safe
    }
  },

  /**
   * Get last sync timestamp from database
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const dealers = await localDB.getDealers();
      if (dealers.length === 0) return null;
      
      // Get the most recent syncedAt timestamp
      const timestamps = dealers
        .map(d => d.syncedAt)
        .filter((t): t is number => typeof t === 'number');
      
      if (timestamps.length === 0) return null;
      return Math.max(...timestamps);
    } catch (error) {
      console.error('[dealerService] Error getting last sync time:', error);
      return null;
    }
  },

  /**
   * Sync dealers from server to local database
   */
  async syncDealers(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('[dealerService] Fetching dealers from server...');
      const axiosInstance = getAxiosInstance();
      const response = await axiosInstance.get<DealerResponse>('/invoice/dealers');

      if (!response.data?.data || !Array.isArray(response.data.data)) {
        console.error('[dealerService] Invalid response format:', response.data);
        return { 
          success: false, 
          count: 0, 
          error: 'Invalid response format from server' 
        };
      }

      const dealers = response.data.data;
      console.log(`[dealerService] Received ${dealers.length} dealers from server`);

      // Save to local database
      const syncedAt = Date.now();
      await localDB.saveDealers(dealers, syncedAt);

      console.log(`[dealerService] Successfully synced ${dealers.length} dealers`);
      return { success: true, count: dealers.length };
    } catch (error: any) {
      console.error('[dealerService] Error syncing dealers:', error);
      return { 
        success: false, 
        count: 0, 
        error: error?.message || 'Unknown error during sync' 
      };
    }
  },

  /**
   * Get all dealers from local database
   */
  async getLocalDealers(): Promise<Dealer[]> {
    try {
      return await localDB.getDealers();
    } catch (error) {
      console.error('[dealerService] Error getting local dealers:', error);
      return [];
    }
  },

  /**
   * Get dealer by ID from local database
   */
  async getDealerById(id: number): Promise<Dealer | null> {
    try {
      const dealers = await localDB.getDealers();
      return dealers.find(d => d.id === id) || null;
    } catch (error) {
      console.error('[dealerService] Error getting dealer by ID:', error);
      return null;
    }
  },

  /**
   * Search dealers by name (offline)
   */
  async searchDealers(query: string): Promise<Dealer[]> {
    try {
      const dealers = await localDB.getDealers();
      const lowerQuery = query.toLowerCase().trim();
      
      if (!lowerQuery) return dealers;
      
      return dealers.filter(d => 
        d.name.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      console.error('[dealerService] Error searching dealers:', error);
      return [];
    }
  },

  /**
   * Get total count of dealers in local database
   */
  async getDealerCount(): Promise<number> {
    try {
      const dealers = await localDB.getDealers();
      return dealers.length;
    } catch (error) {
      console.error('[dealerService] Error getting dealer count:', error);
      return 0;
    }
  },

  /**
   * Force refresh dealers from server
   */
  async forceSync(): Promise<{ success: boolean; count: number; error?: string }> {
    return await this.syncDealers();
  }
};
