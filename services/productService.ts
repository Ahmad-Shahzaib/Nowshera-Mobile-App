import * as SQLite from 'expo-sqlite';
import { getAxiosInstance } from '../lib/axios';
import type { Product, ProductsResponse } from '../types/product';

const DB_NAME = 'naushera.db';
// Note: axios baseURL is already set to ${BASE_URL}/api, so we only need the path after /api
const PRODUCTS_ENDPOINT = '/invoice/products';

// Get database instance
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
 * Product Service - Manages products with offline-first approach
 */
class ProductService {
  /**
   * Get all products from local database
   */
  async getLocalProducts(): Promise<Product[]> {
    try {
      await ensureDB();
      const result = await db.getAllAsync('SELECT * FROM products ORDER BY label ASC');
      return result || [];
    } catch (error) {
      console.error('Error getting local products:', error);
      return [];
    }
  }

  /**
   * Search products by label (all words must match)
   */
  async searchProducts(searchTerm: string): Promise<Product[]> {
    try {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        return this.getLocalProducts();
      }

      await ensureDB();
      // Split search term into words, ignore extra spaces
      const words = trimmed.split(/\s+/).filter(Boolean);
      // Build WHERE clause: label LIKE ? AND label LIKE ? ...
      const whereClauses = words.map(() => 'label LIKE ?').join(' AND ');
      const params = words.map(word => `%${word}%`);
      const sql = `SELECT * FROM products WHERE ${whereClauses} ORDER BY label ASC LIMIT 50`;

      const result = await db.getAllAsync(sql, params);
      return result || [];
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  /**
   * Get product by ID
   */
  async getProductById(id: number): Promise<Product | null> {
    try {
      await ensureDB();
      const result = await db.getFirstAsync('SELECT * FROM products WHERE id = ?', [id]);
      return result || null;
    } catch (error) {
      console.error('Error getting product by ID:', error);
      return null;
    }
  }

  /**
   * Sync products from server
   */
  async syncProducts(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('Fetching products from server...');
      const axios = getAxiosInstance();
      console.log('API Endpoint:', PRODUCTS_ENDPOINT);
      const response = await axios.get<ProductsResponse>(PRODUCTS_ENDPOINT);

      console.log('Response status:', response.status);
      console.log('Response data structure:', {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        dataType: typeof response.data,
      });

      if (!response.data?.data) {
        throw new Error('Invalid response from server');
      }

      const products = response.data.data;
      console.log(`Received ${products.length} products from server`);

      // Start transaction for bulk insert
      await db.withTransactionAsync(async () => {
        // Clear existing products
        await db.runAsync('DELETE FROM products');

        // Insert all products
        const insertStmt = await db.prepareAsync(
          'INSERT INTO products (id, label, name, sku, sale_price, purchase_price, description, type, category_id, unit_id, syncedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        try {
          const syncTime = Date.now();
          for (const item of products) {
            // Handle both flat and nested product structures
            const productData = (item as any).product || item;
            const label = item.label || productData.name || productData.label;
            
            await insertStmt.executeAsync([
              productData.id,
              label,
              productData.name || label,
              productData.sku || '',
              productData.sale_price || '0',
              productData.purchase_price || '0',
              productData.description || '',
              productData.type || 'product',
              productData.category_id || 0,
              productData.unit_id || 0,
              syncTime
            ]);
          }
        } finally {
          await insertStmt.finalizeAsync();
        }
      });

      console.log('Products synced successfully');
      return { success: true, count: products.length };
    } catch (error: any) {
     
      return {
        success: false,
        count: 0,
        error: error?.message || 'Failed to sync products',
      };
    }
  }

  /**
   * Get product count
   */
  async getProductCount(): Promise<number> {
    try {
      await ensureDB();
      const result: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting product count:', error);
      return 0;
    }
  }

  /**
   * Check if products need sync (if empty or older than 24 hours)
   */
  async needsSync(): Promise<boolean> {
    try {
      await ensureDB();
      const result: any = await db.getFirstAsync(
        'SELECT COUNT(*) as count, MAX(syncedAt) as maxSyncedAt FROM products'
      );

      if (!result || result.count === 0) {
        return true;
      }

      // Check if older than 24 hours
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (result.maxSyncedAt && now - result.maxSyncedAt > twentyFourHours) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking product sync status:', error);
      return true;
    }
  }

  /**
   * Get paginated products from local database
   * @param page 1-based page number
   * @param pageSize number of items per page
   * @returns { products: Product[], total: number }
   */
  async getLocalProductsPaginated(page: number, pageSize: number): Promise<{ products: Product[]; total: number }> {
    try {
      await ensureDB();
      const offset = (page - 1) * pageSize;
      const products = await db.getAllAsync(
        'SELECT * FROM products ORDER BY label ASC LIMIT ? OFFSET ?',
        [pageSize, offset]
      );
      const totalRow = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
      return {
        products: products || [],
        total: totalRow?.count || 0,
      };
    } catch (error) {
      console.error('Error getting paginated products:', error);
      return { products: [], total: 0 };
    }
  }
}

/**
 * Category Service - Manages categories with offline-first approach
 */
class CategoryService {
  /**
   * Get all categories from local database
   */
  async getLocalCategories(): Promise<Product[]> {
    try {
      await ensureDB();
      const result = await db.getAllAsync('SELECT * FROM categories ORDER BY name ASC');
      return result || [];
    } catch (error) {
      console.error('Error getting local categories:', error);
      return [];
    }
  }

  /**
   * Sync categories from server
   */
  async syncCategories(): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      console.log('Fetching categories from server...');
      const axios = getAxiosInstance();
      const response = await axios.get('/invoice/categories');

      console.log('Categories response status:', response.status);

      if (!response.data?.data) {
        throw new Error('Invalid response from server');
      }

      const categories = response.data.data;
      console.log(`Received ${categories.length} categories from server`);

      // Start transaction for bulk insert
      await db.withTransactionAsync(async () => {
        // Clear existing categories
        await db.runAsync('DELETE FROM categories');

        // Insert all categories
        const insertStmt = await db.prepareAsync(
          'INSERT INTO categories (id, name, syncedAt) VALUES (?, ?, ?)'
        );

        try {
          const syncTime = Date.now();
          for (const category of categories) {
            await insertStmt.executeAsync([category.id, category.name, syncTime]);
          }
        } finally {
          await insertStmt.finalizeAsync();
        }
      });

      console.log('Categories synced successfully');
      return { success: true, count: categories.length };
    } catch (error: any) {
      console.error('Error syncing categories:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
      });
      return {
        success: false,
        count: 0,
        error: error?.message || 'Failed to sync categories',
      };
    }
  }

  /**
   * Get category count
   */
  async getCategoryCount(): Promise<number> {
    try {
      await ensureDB();
      const result: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM categories');
      return result?.count || 0;
    } catch (error) {
      console.error('Error getting category count:', error);
      return 0;
    }
  }

  /**
   * Check if categories need sync
   */
  async needsSync(): Promise<boolean> {
    try {
      await ensureDB();
      const result: any = await db.getFirstAsync(
        'SELECT COUNT(*) as count, MAX(syncedAt) as maxSyncedAt FROM categories'
      );

      if (!result || result.count === 0) {
        return true;
      }

      const twentyFourHours = 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (result.maxSyncedAt && now - result.maxSyncedAt > twentyFourHours) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking category sync status:', error);
      return true;
    }
  }
}

export const productService = new ProductService();
export const categoryService = new CategoryService();
