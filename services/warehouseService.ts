import * as SQLite from 'expo-sqlite';
import { getAxiosInstance } from '../lib/axios';
import type { Warehouse, WarehouseResponse } from '../types/warehouse';

const DB_NAME = 'naushera.db';
const WAREHOUSES_ENDPOINT = '/invoice/warehouses';

const anySQLite = SQLite as any;
let db: any = null;

async function ensureDB() {
  if (db) return db;
  
  if (anySQLite.openDatabaseSync) {
    db = anySQLite.openDatabaseSync(DB_NAME);
    return db;
  }
  
  if (anySQLite.openDatabaseAsync) {
    db = await anySQLite.openDatabaseAsync(DB_NAME);
    return db;
  }
  
  throw new Error('No compatible SQLite API found');
}

/**
 * Warehouse Service - Manages warehouses with offline-first approach
 */
class WarehouseService {
  /**
   * Get all warehouses from local database
   */
  async getLocalWarehouses(): Promise<Warehouse[]> {
    try {
      await ensureDB();
      const result = await db.getAllAsync('SELECT * FROM warehouses ORDER BY name ASC');
      return result || [];
    } catch (error) {
      console.error('Error getting local warehouses:', error);
      return [];
    }
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(id: number): Promise<Warehouse | null> {
    try {
      await ensureDB();
      const result = await db.getFirstAsync('SELECT * FROM warehouses WHERE id = ?', [id]);
      return result || null;
    } catch (error) {
      console.error('Error getting warehouse by ID:', error);
      return null;
    }
  }

  /**
   * Sync warehouses from server
   */
  async syncWarehouses(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('Fetching warehouses from server...');
      const axios = getAxiosInstance();
      const response = await axios.get<WarehouseResponse>(WAREHOUSES_ENDPOINT);

      if (!response.data?.data) {
        throw new Error('Invalid response from server');
      }

      const warehouses = response.data.data;
      console.log(`Received ${warehouses.length} warehouses from server`);

      // Save to local database
      await this.saveWarehouses(warehouses);

      return { success: true, count: warehouses.length };
    } catch (error: any) {
      console.error('Error syncing warehouses:', error);
      return { 
        success: false, 
        count: 0, 
        error: error.message || 'Failed to sync warehouses' 
      };
    }
  }

  /**
   * Save warehouses to local database
   */
  async saveWarehouses(warehouses: Warehouse[]): Promise<void> {
    try {
      await ensureDB();
      
      // Use transaction for batch insert
      const timestamp = Date.now();
      
      for (const warehouse of warehouses) {
        await db.runAsync(
          `INSERT OR REPLACE INTO warehouses (id, name, syncedAt) VALUES (?, ?, ?)`,
          [warehouse.id, warehouse.name, timestamp]
        );
      }

      console.log(`Saved ${warehouses.length} warehouses to local database`);
    } catch (error) {
      console.error('Error saving warehouses:', error);
      throw error;
    }
  }

  /**
   * Clear all warehouses from local database
   */
  async clearWarehouses(): Promise<void> {
    try {
      await ensureDB();
      await db.runAsync('DELETE FROM warehouses');
      console.log('Cleared all warehouses from local database');
    } catch (error) {
      console.error('Error clearing warehouses:', error);
      throw error;
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      await ensureDB();
      const result = await db.getFirstAsync('SELECT MAX(syncedAt) as lastSync FROM warehouses');
      return result?.lastSync || null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }
}

export const warehouseService = new WarehouseService();
