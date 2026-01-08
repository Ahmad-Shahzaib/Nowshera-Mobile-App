import * as SQLite from "expo-sqlite";
import { AppState, AppStateStatus } from 'react-native';

const DB_NAME = 'naushera.db';

const anySQLite = SQLite as any;
let db: any = null;
let openingPromise: Promise<any> | null = null;
let isClosing = false;

async function ensureOpen() {
  if (isClosing) {
    // Wait a bit if we're in the middle of closing
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (db) return db;
  if (openingPromise) return openingPromise;

  openingPromise = (async () => {
    if (anySQLite.openDatabaseSync) {
      db = anySQLite.openDatabaseSync(DB_NAME);
      return db;
    }

    if (anySQLite.openDatabase) {
      db = anySQLite.openDatabase(DB_NAME);
      return db;
    }

    if (anySQLite.openDatabaseAsync) {
      db = await anySQLite.openDatabaseAsync(DB_NAME);
      return db;
    }

    throw new Error('No compatible SQLite API found at runtime');
  })();

  try {
    const res = await openingPromise;
    if (verboseLogging) console.info('[localDatabase] DB opened');
    return res;
  } finally {
    openingPromise = null;
  }
}

// optional verbose logging for diagnostics
let verboseLogging = false;
let lastErrorTime = 0;
let errorCount = 0;
const ERROR_LOG_INTERVAL = 5000; // Only log errors every 5 seconds max
let dbInitialized = false; // Track if DB has been initialized
let initDBPromise: Promise<void> | null = null; // Guard against concurrent initDB calls

export function enableDbLogging(enable = true) {
  verboseLogging = enable;
}

let appStateListenerRegistered = false;
try {
  if (AppState && !appStateListenerRegistered) {
    AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        ensureOpen().catch((e) => {
          if (verboseLogging) console.error('[localDatabase] ensureOpen failed on resume', e);
        });
      }
    });
    appStateListenerRegistered = true;
  }
} catch (e) {
  // ignore if AppState isn't available in this environment
}

export type CustomerRow = {
  id: string;
  serverId?: string | null;
  name: string;
  contact?: string | null;
  email?: string | null;
  taxNumber?: string | null;
  openingBalance?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  syncError?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: number;
};

export type InvoiceRow = {
  id: string;
  serverId?: string | null;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  customerType?: string;
  categoryId?: string;
  warehouseId?: string;
  warehouseName?: string;
  refNumber?: string;
  deliveryStatus?: string;
  issueDate: string;
  dueDate?: string;
  subTotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  dueAmount: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  createdAt: string;
  updatedAt: string;
  synced: number;
  syncStatus?: 'UNSYNCED' | 'SYNCED' | 'FAILED';
  syncError?: string | null;
};

export type InvoiceItemRow = {
  id: string;
  invoiceId: string;
  productId: number;
  productName?: string;
  quantity: number;
  price: number;
  discount?: number;
  tax?: number;
  description?: string;
  shopId?: number;
  createdAt: string;
};

export type InvoicePaymentRow = {
  id: string;
  invoiceId: string;
  amount: number;
  accountId: number;
  accountName?: string;
  paymentMethod?: number;
  date: string;
  reference?: string;
  createdAt: string;
};

async function execSql<T = any>(sql: string, args: any[] = [], _retryCount = 0): Promise<T> {
  // inner executor: performs a single exec attempt and may retry without
  // re-entering the external mutex.
  const innerExec = async (sqlInner: string, argsInner: any[] = [], retryCount = 0): Promise<T> => {
    await ensureOpen();
    const anyDb = db as any;

    try {
      if (typeof anyDb?.transaction === "function") {
        return await new Promise((resolve, reject) => {
          anyDb.transaction((tx: any) => {
            tx.executeSql(
              sqlInner,
              argsInner,
              (_tx: any, res: any) => resolve(res),
              (_tx: any, err: any) => {
                reject(err);
                return false;
              }
            );
          });
        }) as any;
      }

      const isSelect = sqlInner.trim().toUpperCase().startsWith('SELECT');

      // Use getAllAsync for SELECT queries, runAsync for INSERT/UPDATE/DELETE
      if (typeof anyDb?.getAllAsync === "function" && isSelect) {
        const rowsArr = await anyDb.getAllAsync(sqlInner, argsInner);
        return {
          rows: { length: rowsArr.length, item: (i: number) => rowsArr[i] },
          insertId: undefined,
          rowsAffected: 0,
        } as any;
      }

      if (typeof anyDb?.runAsync === "function" && !isSelect) {
        const result = await anyDb.runAsync(sqlInner, argsInner);
        return {
          rows: { length: 0, item: () => null },
          insertId: result.lastInsertRowId,
          rowsAffected: result.changes,
        } as any;
      }

      // Fallback: try runAsync for SELECT if getAllAsync not available
      if (typeof anyDb?.runAsync === "function") {
        const result = await anyDb.runAsync(sqlInner, argsInner);
        return {
          rows: { length: 0, item: () => null },
          insertId: result.lastInsertRowId,
          rowsAffected: result.changes,
        } as any;
      }

      // Sync versions
      if (typeof anyDb?.getAllSync === "function" && isSelect) {
        const rowsArr = anyDb.getAllSync(sqlInner, argsInner);
        return {
          rows: { length: rowsArr.length, item: (i: number) => rowsArr[i] },
          insertId: undefined,
          rowsAffected: 0,
        } as any;
      }

      if (typeof anyDb?.runSync === "function" && !isSelect) {
        const result = anyDb.runSync(sqlInner, argsInner);
        return {
          rows: { length: 0, item: () => null },
          insertId: result.lastInsertRowId,
          rowsAffected: result.changes,
        } as any;
      }

      if (typeof anyDb?.runSync === "function") {
        const result = anyDb.runSync(sqlInner, argsInner);
        return {
          rows: { length: 0, item: () => null },
          insertId: result.lastInsertRowId,
          rowsAffected: result.changes,
        } as any;
      }

      if (typeof anyDb?.execAsync === "function") {
        await anyDb.execAsync(sqlInner);
        return { rows: { length: 0, item: () => null } } as any;
      }

      if (typeof anyDb?.execSync === "function") {
        anyDb.execSync(sqlInner);
        return { rows: { length: 0, item: () => null } } as any;
      }

      if (anySQLite.openDatabaseAsync && !anyDb) {
        const opened = await anySQLite.openDatabaseAsync(DB_NAME);
        db = opened;
        return innerExec(sqlInner, argsInner, retryCount);
      }

      throw new Error("No compatible SQLite API found at runtime");
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isClosedError = /closed|closed resource|access to closed/i.test(msg);
      const shouldRetry = retryCount < 2 && isClosedError;

      // Throttle error logging to prevent console flooding
      const now = Date.now();
      if (verboseLogging && (!isClosedError || now - lastErrorTime > ERROR_LOG_INTERVAL)) {
        lastErrorTime = now;
        errorCount++;
        const callerStack = new Error().stack;
        console.error('[localDatabase] execSql error', {
          sql: typeof sqlInner === 'string' ? sqlInner.slice(0, 200) : sqlInner,
          argsLength: Array.isArray(argsInner) ? argsInner.length : 0,
          retryCount,
          message: msg,
          errorCount,
          errorStack: err?.stack,
          callerStack,
        });
      }

      if (shouldRetry && anySQLite.openDatabaseAsync) {
        if (verboseLogging && now - lastErrorTime > ERROR_LOG_INTERVAL) {
          console.info('[localDatabase] detected closed DB resource, attempting reopen');
        }
        try {
          // Close the old reference and wait for any pending operations
          db = null;
          isClosing = true;
          await new Promise(resolve => setTimeout(resolve, 100));
          isClosing = false;
          
          // Reopen
          const reopened = await anySQLite.openDatabaseAsync(DB_NAME);
          db = reopened;
          if (verboseLogging && now - lastErrorTime > ERROR_LOG_INTERVAL) {
            console.info('[localDatabase] reopened DB, retrying SQL');
          }
          return innerExec(sqlInner, argsInner, retryCount + 1);
        } catch (e) {
          if (verboseLogging) console.error('[localDatabase] reopen attempt failed', e);
          isClosing = false;
        }
      }

      // Don't throw on closed resource errors after retry attempts
      if (isClosedError && retryCount >= 2) {
        if (verboseLogging && now - lastErrorTime > ERROR_LOG_INTERVAL) {
          console.warn('[localDatabase] giving up after retries, returning empty result');
        }
        return { rows: { length: 0, item: () => null } } as any;
      }

      throw err;
    }
  };

  // simple mutex to serialize DB calls
  (global as any).__local_db_mutex = (global as any).__local_db_mutex || Promise.resolve();
  const mutex: Promise<any> = (global as any).__local_db_mutex;
  const run = async () => innerExec(sql, args, _retryCount);
  const next = mutex.then(run, run);
  (global as any).__local_db_mutex = next.catch(() => {});
  return next;
}

export async function initDB() {
  // Guard against concurrent initDB calls
  if (initDBPromise) {
    return initDBPromise;
  }

  initDBPromise = (async () => {
    try {
      await execSql(
        `CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY NOT NULL,
          serverId TEXT,
          name TEXT,
          contact TEXT,
          email TEXT,
          syncError TEXT,
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
        );`
      );
      
      // ALWAYS check and migrate invoices table schema (every load, not just first time)
      // This ensures old databases with missing columns get fixed
      // BUT: Use PRAGMA table_info to check safely WITHOUT reading data
      {
        let needsInvoiceRecreate = false;
        try {
          const info: any = await execSql(`PRAGMA table_info('invoices');`);
          const cols: string[] = [];
          for (let i = 0; i < info.rows.length; i++) {
            cols.push(info.rows.item(i).name);
          }
          
          if (!cols.includes('syncStatus') || !cols.includes('syncError')) {
            needsInvoiceRecreate = true;
            console.warn('[localDatabase] ⚠️  Invoices table missing sync columns, will recreate...');
          } else {
            if (verboseLogging) console.log('[localDatabase] ✓ Invoices table has required columns');
          }
        } catch (e: any) {
          // If table doesn't exist yet, that's fine - will be created below
          const msg = String(e?.message || e);
          if (!msg.includes('no such table')) {
            console.warn('[localDatabase] Error checking invoices table schema:', e);
          }
        }
        
        if (needsInvoiceRecreate) {
          let dropSucceeded = false;
          let dropAttempts = 0;
          
          // Retry dropping tables up to 3 times in case of database lock
          while (!dropSucceeded && dropAttempts < 3) {
            try {
              dropAttempts++;
              console.log(`[localDatabase] Recreating invoice tables (attempt ${dropAttempts}/3)...`);
              
              // Drop tables with small delay between operations
              await execSql(`DROP TABLE IF EXISTS invoice_payments;`);
              await new Promise(resolve => setTimeout(resolve, 100));
              
              await execSql(`DROP TABLE IF EXISTS invoice_items;`);
              await new Promise(resolve => setTimeout(resolve, 100));
              
              await execSql(`DROP TABLE IF EXISTS invoices;`);
              
              console.log('[localDatabase] ✓ Dropped outdated invoice tables');
              dropSucceeded = true;
            } catch (e: any) {
              const msg = String(e?.message || e);
              if (msg.includes('database is locked')) {
                console.warn(`[localDatabase] Database locked when dropping tables (attempt ${dropAttempts}/3), waiting...`);
                // Wait a bit longer before retry
                await new Promise(resolve => setTimeout(resolve, 500 * dropAttempts));
              } else {
                console.error(`[localDatabase] Failed to drop invoice tables (attempt ${dropAttempts}/3):`, e);
                if (dropAttempts >= 3) {
                  console.warn('[localDatabase] Giving up on table recreation - tables will be created as-is');
                  break;
                }
              }
            }
          }
        }
      }
      
      // Only run other migrations once per session
      if (!dbInitialized) {
        // Ensure customers table has syncError column (migration)
        try {
          const info: any = await execSql(`PRAGMA table_info('customers');`);
          const cols: string[] = [];
          for (let i = 0; i < info.rows.length; i++) cols.push(info.rows.item(i).name);
          if (!cols.includes('syncError')) {
            console.log('[localDatabase] Adding missing column syncError to customers table');
            await execSql(`ALTER TABLE customers ADD COLUMN syncError TEXT;`);
          }
        } catch (e) {
          console.warn('[localDatabase] Failed to ensure customers.syncError exists:', e);
        }
        
        let needsProductsRecreate = false;
        try {
          const info: any = await execSql(`PRAGMA table_info('products');`);
          const cols: string[] = [];
          for (let i = 0; i < info.rows.length; i++) {
            cols.push(info.rows.item(i).name);
          }
          // Check if products table has the required columns
          if (!cols.includes('sale_price') || !cols.includes('name')) {
            needsProductsRecreate = true;
            console.log('[localDatabase] Products table schema outdated, recreating...');
          }
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (!msg.includes('no such table')) {
            console.warn('[localDatabase] Error checking products table schema:', e);
          }
        }
        
        if (needsProductsRecreate) {
          // Drop and recreate the products table with correct schema
          try {
            await execSql(`DROP TABLE IF EXISTS products;`);
            console.log('[localDatabase] Dropped old products table');
          } catch (e) {
            console.warn('[localDatabase] Failed to drop old products table:', e);
          }
        }
        
        dbInitialized = true;
      }
      
      await execSql(
        `CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY NOT NULL,
          serverId TEXT,
          invoiceNo TEXT,
          customerId TEXT,
          customerName TEXT,
          customerType TEXT,
          categoryId TEXT,
          warehouseId TEXT,
          warehouseName TEXT,
          refNumber TEXT,
          deliveryStatus TEXT,
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
          synced INTEGER DEFAULT 0,
          syncStatus TEXT DEFAULT 'UNSYNCED',
          syncError TEXT
        );`
      );
      
      // Create products table
      await execSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY NOT NULL,
          label TEXT NOT NULL,
          name TEXT,
          sku TEXT,
          sale_price TEXT,
          purchase_price TEXT,
          description TEXT,
          type TEXT,
          category_id INTEGER,
          unit_id INTEGER,
          syncedAt INTEGER
        );`
      );
      
      // Create index on product label for faster search
      await execSql(
        `CREATE INDEX IF NOT EXISTS idx_products_label ON products(label);`
      );
      
      // Create invoice_items table
      await execSql(
        `CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY NOT NULL,
          invoiceId TEXT NOT NULL,
          productId TEXT,
          productName TEXT,
          quantity TEXT,
          price TEXT,
          discount TEXT,
          tax TEXT,
          description TEXT,
          shopId TEXT,
          createdAt TEXT,
          FOREIGN KEY(invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
        );`
      );
      
      // Create invoice_payments table
      await execSql(
        `CREATE TABLE IF NOT EXISTS invoice_payments (
          id TEXT PRIMARY KEY NOT NULL,
          invoiceId TEXT NOT NULL,
          amount TEXT,
          accountId TEXT,
          accountName TEXT,
          paymentMethod TEXT,
          date TEXT,
          reference TEXT,
          createdAt TEXT,
          FOREIGN KEY(invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
        );`
      );
      
      // Create dealers table
      await execSql(
        `CREATE TABLE IF NOT EXISTS dealers (
          id TEXT PRIMARY KEY NOT NULL,
          serverId TEXT,
          name TEXT NOT NULL,
          description TEXT,
          syncError TEXT,
          syncedAt INTEGER,
          createdAt TEXT,
          updatedAt TEXT,
          synced INTEGER DEFAULT 0
        );`
      );
      
      // Ensure dealers table has syncedAt column (migration)
      try {
        const info: any = await execSql(`PRAGMA table_info('dealers');`);
        const cols: string[] = [];
        for (let i = 0; i < info.rows.length; i++) cols.push(info.rows.item(i).name);
        if (!cols.includes('syncedAt')) {
          console.log('[localDatabase] Adding missing column syncedAt to dealers table');
          await execSql(`ALTER TABLE dealers ADD COLUMN syncedAt INTEGER;`);
        }
      } catch (e) {
        console.warn('[localDatabase] Failed to ensure dealers.syncedAt exists:', e);
      }

      // Create bank_accounts table
      await execSql(
        `CREATE TABLE IF NOT EXISTS bank_accounts (
          id TEXT PRIMARY KEY NOT NULL,
          warehouseId TEXT,
          holderName TEXT,
          bankName TEXT,
          accountNumber TEXT,
          chartAccountId TEXT,
          openingBalance TEXT,
          contactNumber TEXT,
          bankAddress TEXT,
          createdBy TEXT,
          shopId TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          syncedAt TEXT
        );`
      );
      
      // Ensure bank_accounts table has all required columns (migration)
      try {
        const info: any = await execSql(`PRAGMA table_info('bank_accounts');`);
        const cols: string[] = [];
        for (let i = 0; i < info.rows.length; i++) cols.push(info.rows.item(i).name);
        if (!cols.includes('holderName')) {
          console.log('[localDatabase] Adding missing column holderName to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN holderName TEXT;`);
        }
        if (!cols.includes('bankName')) {
          console.log('[localDatabase] Adding missing column bankName to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN bankName TEXT;`);
        }
        if (!cols.includes('accountNumber')) {
          console.log('[localDatabase] Adding missing column accountNumber to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN accountNumber TEXT;`);
        }
        if (!cols.includes('chartAccountId')) {
          console.log('[localDatabase] Adding missing column chartAccountId to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN chartAccountId TEXT;`);
        }
        if (!cols.includes('openingBalance')) {
          console.log('[localDatabase] Adding missing column openingBalance to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN openingBalance TEXT;`);
        }
        if (!cols.includes('contactNumber')) {
          console.log('[localDatabase] Adding missing column contactNumber to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN contactNumber TEXT;`);
        }
        if (!cols.includes('bankAddress')) {
          console.log('[localDatabase] Adding missing column bankAddress to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN bankAddress TEXT;`);
        }
        // Legacy 'name' column used by older schema versions (ensure exists for compatibility)
        if (!cols.includes('name')) {
          console.log('[localDatabase] Adding missing legacy column name to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN name TEXT;`);
        }
        if (!cols.includes('createdBy')) {
          console.log('[localDatabase] Adding missing column createdBy to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN createdBy TEXT;`);
        }
        if (!cols.includes('shopId')) {
          console.log('[localDatabase] Adding missing column shopId to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN shopId TEXT;`);
        }
        if (!cols.includes('syncedAt')) {
          console.log('[localDatabase] Adding missing column syncedAt to bank_accounts table');
          await execSql(`ALTER TABLE bank_accounts ADD COLUMN syncedAt TEXT;`);
        }
      } catch (e) {
        console.warn('[localDatabase] Failed to ensure bank_accounts columns exist:', e);
      }

      // Create warehouses table
      await execSql(
        `CREATE TABLE IF NOT EXISTS warehouses (
          id TEXT PRIMARY KEY NOT NULL,
          serverId TEXT,
          name TEXT NOT NULL,
          code TEXT,
          description TEXT,
          syncError TEXT,
          syncedAt INTEGER,
          createdAt TEXT,
          updatedAt TEXT,
          synced INTEGER DEFAULT 0
        );`
      );
      
      // Ensure warehouses table has syncedAt column (migration)
      try {
        const info: any = await execSql(`PRAGMA table_info('warehouses');`);
        const cols: string[] = [];
        for (let i = 0; i < info.rows.length; i++) cols.push(info.rows.item(i).name);
        if (!cols.includes('syncedAt')) {
          console.log('[localDatabase] Adding missing column syncedAt to warehouses table');
          await execSql(`ALTER TABLE warehouses ADD COLUMN syncedAt INTEGER;`);
        }
      } catch (e) {
        console.warn('[localDatabase] Failed to ensure warehouses.syncedAt exists:', e);
      }
      
      // Create categories table
      await execSql(
        `CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          syncedAt INTEGER
        );`
      );
      
      console.log('[localDatabase] ✓ Database initialized successfully');
    } catch (error) {
      console.error('[localDatabase] Failed to initialize database:', error);
      throw error;
    } finally {
      // Clear the promise so future calls can proceed
      initDBPromise = null;
    }
  })();

  return initDBPromise;
}

export async function addCustomer(payload: Partial<CustomerRow>) {
  const id = payload.id ?? `local_${Date.now()}`;
  const now = new Date().toISOString();
  const row: CustomerRow = {
    id,
    serverId: payload.serverId ?? null,
    name: payload.name ?? "",
    contact: payload.contact ?? null,
    email: payload.email ?? null,
    syncError: payload.syncError ?? null,
    taxNumber: payload.taxNumber ?? null,
    openingBalance: payload.openingBalance ?? null,
    address: payload.address ?? null,
    city: payload.city ?? null,
    state: payload.state ?? null,
    country: payload.country ?? null,
    zip: payload.zip ?? null,
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
    synced: payload.synced ?? 0,
  };

  await execSql(
    `INSERT INTO customers (id, serverId, name, contact, email, syncError, taxNumber, openingBalance, address, city, state, country, zip, createdAt, updatedAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      row.id,
      row.serverId,
      row.name,
      row.contact,
      row.email,
      row.syncError,
      row.taxNumber,
      row.openingBalance,
      row.address,
      row.city,
      row.state,
      row.country,
      row.zip,
      row.createdAt,
      row.updatedAt,
      row.synced,
    ]
  );

  return row;
}

export async function getCustomers(): Promise<CustomerRow[]> {
  const res: any = await execSql(`SELECT * FROM customers ORDER BY createdAt DESC;`);
  const output: CustomerRow[] = [];
  for (let i = 0; i < res.rows.length; i++) output.push(res.rows.item(i));
  return output;
}

export async function getUnsynced(): Promise<CustomerRow[]> {
  const res: any = await execSql(`SELECT * FROM customers WHERE synced = 0 ORDER BY createdAt ASC;`);
  const output: CustomerRow[] = [];
  for (let i = 0; i < res.rows.length; i++) output.push(res.rows.item(i));
  return output;
}

export async function markAsSynced(localId: string, serverId?: string) {
  const now = new Date().toISOString();
  await execSql(
    `UPDATE customers SET synced = 1, serverId = ?, updatedAt = ? WHERE id = ?;`,
    [serverId ?? null, now, localId]
  );
}

export async function markCustomerAsError(localId: string, message?: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await execSql(`UPDATE customers SET synced = -1, syncError = ?, updatedAt = ? WHERE id = ?;`, [message ?? null, now, localId]);
    console.warn(`[localDatabase] Marked customer ${localId} as error (message: ${message})`);
  } catch (error) {
    console.error('[localDatabase] markCustomerAsError failed:', error);
    throw error;
  }
}

export async function updateCustomer(localId: string, patch: Partial<CustomerRow>) {
  const parts: string[] = [];
  const args: any[] = [];

  if (patch.name !== undefined) { parts.push("name = ?"); args.push(patch.name); }
  if (patch.contact !== undefined) { parts.push("contact = ?"); args.push(patch.contact); }
  if (patch.email !== undefined) { parts.push("email = ?"); args.push(patch.email); }
  if (patch.openingBalance !== undefined) { parts.push("openingBalance = ?"); args.push(patch.openingBalance); }
  if (patch.address !== undefined) { parts.push("address = ?"); args.push(patch.address); }
  if (patch.city !== undefined) { parts.push("city = ?"); args.push(patch.city); }
  if (patch.state !== undefined) { parts.push("state = ?"); args.push(patch.state); }
  if (patch.country !== undefined) { parts.push("country = ?"); args.push(patch.country); }
  if (patch.zip !== undefined) { parts.push("zip = ?"); args.push(patch.zip); }
  if (patch.synced !== undefined) { parts.push("synced = ?"); args.push(patch.synced); }
  if (patch.serverId !== undefined) { parts.push("serverId = ?"); args.push(patch.serverId); }

  if (parts.length === 0) return;

  args.push(new Date().toISOString());
  args.push(localId);

  const sql = `UPDATE customers SET ${parts.join(", ")}, updatedAt = ? WHERE id = ?;`;
  await execSql(sql, args);
}

export async function deleteCustomer(localId: string) {
  await execSql(`DELETE FROM customers WHERE id = ?;`, [localId]);
}

export async function getCustomerById(localId: string): Promise<CustomerRow | null> {
  const res: any = await execSql(`SELECT * FROM customers WHERE id = ? OR serverId = ?;`, [localId, localId]);
  return res.rows.length > 0 ? res.rows.item(0) : null;
}

export async function clearAllCustomers() {
  await execSql(`DELETE FROM customers;`);
}

export async function upsertCustomer(payload: Partial<CustomerRow> & { serverId?: string }) {
  // Check if customer already exists by serverId or id
  const existing = payload.serverId 
    ? await execSql(`SELECT * FROM customers WHERE serverId = ?;`, [payload.serverId])
    : null;
  
  if (existing && existing.rows && existing.rows.length > 0) {
    // Update existing customer
    const existingRow = existing.rows.item(0);
    await updateCustomer(existingRow.id, { ...payload, synced: 1 });
    return existingRow.id;
  } else {
    // Insert new customer
    const row = await addCustomer({ ...payload, synced: 1 });
    return row.id;
  }
}

// Invoice functions
export async function addInvoice(payload: Partial<InvoiceRow>) {
  let row: InvoiceRow | null = null;
  
  try {
    const id = payload.id ?? `invoice_${Date.now()}`;
    const now = new Date().toISOString();
    row = {
      id,
      serverId: payload.serverId ?? null,
      invoiceNo: payload.invoiceNo ?? "",
      customerId: payload.customerId ?? "",
      customerName: payload.customerName ?? "",
      warehouseId: payload.warehouseId,
      warehouseName: payload.warehouseName,
      issueDate: payload.issueDate ?? now,
      dueDate: payload.dueDate,
      subTotal: payload.subTotal ?? "0",
      discountTotal: payload.discountTotal ?? "0",
      taxTotal: payload.taxTotal ?? "0",
      grandTotal: payload.grandTotal ?? "0",
      dueAmount: payload.dueAmount ?? "0",
      status: payload.status ?? 'Unpaid',
      createdAt: payload.createdAt ?? now,
      updatedAt: now,
      synced: payload.synced ?? 0,
      syncStatus: payload.syncStatus ?? 'UNSYNCED',
      syncError: payload.syncError ?? null,
    };

    const result = await execSql(
      `INSERT INTO invoices (id, serverId, invoiceNo, customerId, customerName, warehouseId, warehouseName, issueDate, dueDate, subTotal, discountTotal, taxTotal, grandTotal, dueAmount, status, createdAt, updatedAt, synced, syncStatus, syncError)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.id,
        row.serverId,
        row.invoiceNo,
        row.customerId,
        row.customerName,
        row.warehouseId,
        row.warehouseName,
        row.issueDate,
        row.dueDate,
        row.subTotal,
        row.discountTotal,
        row.taxTotal,
        row.grandTotal,
        row.dueAmount,
        row.status,
        row.createdAt,
        row.updatedAt,
        row.synced,
        row.syncStatus,
        row.syncError,
      ]
    );
    
    console.log('[localDatabase] ✓ Invoice inserted:', row.invoiceNo);
    return row;
  } catch (error: any) {
    // If we get "no column named syncStatus" error, it means initDB didn't complete properly
    // This should be rare since we check and recreate the schema in initDB
    if (error?.message?.includes('no column named') || error?.message?.includes('no such column')) {
      console.error('[localDatabase] ⚠️  CRITICAL: Invoices table schema incomplete!');
      console.error('[localDatabase] This should have been fixed in initDB(). Error:', error);
      console.error('[localDatabase] Try: Restart the app, or reinstall if problem persists');
    }
    
    console.error('[localDatabase] addInvoice failed:', error);
    throw error;
  }
}

export async function getInvoices(): Promise<InvoiceRow[]> {
  const res: any = await execSql(`SELECT * FROM invoices ORDER BY createdAt DESC;`);
  console.log('[localDatabase] getInvoices query result:', {
    rowsLength: res.rows?.length || 0,
    hasRows: !!res.rows,
    result: res
  });
  const output: InvoiceRow[] = [];
  for (let i = 0; i < res.rows.length; i++) output.push(res.rows.item(i));
  return output;
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const res: any = await execSql(`SELECT * FROM invoices WHERE id = ?;`, [id]);
  return res.rows.length > 0 ? res.rows.item(0) : null;
}

export async function updateInvoice(localId: string, patch: Partial<InvoiceRow>) {
  const parts: string[] = [];
  const args: any[] = [];

  if (patch.invoiceNo !== undefined) { parts.push("invoiceNo = ?"); args.push(patch.invoiceNo); }
  if (patch.customerId !== undefined) { parts.push("customerId = ?"); args.push(patch.customerId); }
  if (patch.customerName !== undefined) { parts.push("customerName = ?"); args.push(patch.customerName); }
  if (patch.warehouseId !== undefined) { parts.push("warehouseId = ?"); args.push(patch.warehouseId); }
  if (patch.warehouseName !== undefined) { parts.push("warehouseName = ?"); args.push(patch.warehouseName); }
  if (patch.issueDate !== undefined) { parts.push("issueDate = ?"); args.push(patch.issueDate); }
  if (patch.dueDate !== undefined) { parts.push("dueDate = ?"); args.push(patch.dueDate); }
  if (patch.subTotal !== undefined) { parts.push("subTotal = ?"); args.push(patch.subTotal); }
  if (patch.discountTotal !== undefined) { parts.push("discountTotal = ?"); args.push(patch.discountTotal); }
  if (patch.taxTotal !== undefined) { parts.push("taxTotal = ?"); args.push(patch.taxTotal); }
  if (patch.grandTotal !== undefined) { parts.push("grandTotal = ?"); args.push(patch.grandTotal); }
  if (patch.dueAmount !== undefined) { parts.push("dueAmount = ?"); args.push(patch.dueAmount); }
  if (patch.status !== undefined) { parts.push("status = ?"); args.push(patch.status); }
  if (patch.synced !== undefined) { parts.push("synced = ?"); args.push(patch.synced); }
  if (patch.serverId !== undefined) { parts.push("serverId = ?"); args.push(patch.serverId); }
  if (patch.syncStatus !== undefined) { parts.push("syncStatus = ?"); args.push(patch.syncStatus); }
  if (patch.syncError !== undefined) { parts.push("syncError = ?"); args.push(patch.syncError); }

  if (parts.length === 0) return;

  args.push(new Date().toISOString());
  args.push(localId);

  const sql = `UPDATE invoices SET ${parts.join(", ")}, updatedAt = ? WHERE id = ?;`;
  await execSql(sql, args);
}

export async function deleteInvoice(localId: string) {
  await execSql(`DELETE FROM invoices WHERE id = ?;`, [localId]);
}

export async function getUnsyncedInvoices(): Promise<InvoiceRow[]> {
  const res: any = await execSql(`SELECT * FROM invoices WHERE syncStatus = 'UNSYNCED' ORDER BY createdAt ASC;`);
  const output: InvoiceRow[] = [];
  for (let i = 0; i < res.rows.length; i++) output.push(res.rows.item(i));
  return output;
}

export async function markInvoiceAsSynced(localId: string, serverId?: string) {
  const now = new Date().toISOString();
  await execSql(
    `UPDATE invoices SET synced = 1, syncStatus = 'SYNCED', serverId = ?, syncError = NULL, updatedAt = ? WHERE id = ?;`,
    [serverId ?? null, now, localId]
  );
}

export async function markInvoiceAsFailed(localId: string, errorMessage: string) {
  const now = new Date().toISOString();
  await execSql(
    `UPDATE invoices SET syncStatus = 'FAILED', syncError = ?, updatedAt = ? WHERE id = ?;`,
    [errorMessage, now, localId]
  );
}

export async function clearAllInvoices() {
  await execSql(`DELETE FROM invoices;`);
}

export async function upsertInvoice(invoice: Partial<InvoiceRow>): Promise<string> {
  try {
    if (invoice.serverId) {
      const res: any = await execSql(`SELECT id FROM invoices WHERE serverId = ?;`, [invoice.serverId]);
      if (res.rows.length > 0) {
        const localId = res.rows.item(0).id;
        await updateInvoice(localId, { ...invoice, synced: 1, syncStatus: 'SYNCED' });
        return localId;
      }
    }
    if (invoice.id) {
      const existing = await getInvoiceById(invoice.id);
      if (existing) {
        await updateInvoice(invoice.id, { ...invoice, synced: 1, syncStatus: 'SYNCED' });
        return invoice.id;
      }
    }
    const row = await addInvoice({ ...invoice, synced: 1, syncStatus: 'SYNCED' });
    return row.id;
  } catch (error) {
    console.error('[localDatabase] upsertInvoice failed:', error, 'Invoice:', invoice);
    throw error;
  }
}

export async function updateInvoicesCustomerId(oldCustomerId: string, newCustomerId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await execSql(
      `UPDATE invoices SET customerId = ?, updatedAt = ? WHERE customerId = ?;`,
      [newCustomerId, now, oldCustomerId]
    );
    console.log(`[localDatabase] Updated invoices customerId from ${oldCustomerId} to ${newCustomerId}`);
  } catch (error) {
    console.error('[localDatabase] updateInvoicesCustomerId failed:', error);
    throw error;
  }
}

// ========================================
// Dealers CRUD Operations
// ========================================

export async function saveDealers(dealers: Array<{ id: number; name: string }>, syncedAt: number) {
  try {
    // Clear existing dealers
    await execSql(`DELETE FROM dealers;`);
    
    // Insert new dealers
    for (const dealer of dealers) {
      await execSql(
        `INSERT OR REPLACE INTO dealers (id, name, syncedAt) VALUES (?, ?, ?);`,
        [dealer.id, dealer.name, syncedAt]
      );
    }
    
    if (verboseLogging) console.info(`[localDatabase] Saved ${dealers.length} dealers`);
  } catch (error) {
    console.error('[localDatabase] saveDealers failed:', error);
    throw error;
  }
}

export async function getDealers(): Promise<Array<{ id: number; name: string; syncedAt?: number }>> {
  try {
    const res: any = await execSql(`SELECT id, name, syncedAt FROM dealers ORDER BY name ASC;`);
    const dealers = [];
    for (let i = 0; i < res.rows.length; i++) {
      dealers.push(res.rows.item(i));
    }
    return dealers;
  } catch (error) {
    console.error('[localDatabase] getDealers failed:', error);
    return [];
  }
}

export async function clearAllDealers() {
  await execSql(`DELETE FROM dealers;`);
}

// ========================================
// Bank Accounts CRUD Operations
// ========================================

export type BankAccountRow = {
  id: number;
  warehouseId: number;
  holderName: string;
  bankName: string;
  accountNumber: string;
  chartAccountId: number;
  openingBalance: number;
  contactNumber: string;
  bankAddress: string;
  createdBy: number;
  shopId: number | null;
  createdAt: string;
  updatedAt: string;
  syncedAt?: number;
};

export async function saveBankAccounts(bankAccounts: Array<{
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
}>, syncedAt: number) {
  try {
    // Clear existing bank accounts
    await execSql(`DELETE FROM bank_accounts;`);

    // Read current table columns so we can insert only into existing columns
    const info: any = await execSql(`PRAGMA table_info('bank_accounts');`);
    const cols: string[] = [];
    for (let i = 0; i < info.rows.length; i++) cols.push(info.rows.item(i).name);

    // Build insert column list based on available columns (handles legacy 'name' column)
    const insertCols: string[] = [];
    const pushIf = (c: string) => { if (cols.includes(c)) insertCols.push(c); };

    pushIf('id');
    pushIf('warehouseId');
    pushIf('holderName');
    pushIf('bankName');
    // legacy column that caused NOT NULL failures in some DBs
    pushIf('name');
    pushIf('accountNumber');
    pushIf('chartAccountId');
    pushIf('openingBalance');
    pushIf('contactNumber');
    pushIf('bankAddress');
    pushIf('createdBy');
    pushIf('shopId');
    pushIf('createdAt');
    pushIf('updatedAt');
    pushIf('syncedAt');

    // Guard: if no insertable columns detected, fall back to default known columns
    if (insertCols.length === 0) {
      console.warn('[localDatabase.saveBankAccounts] No insertable columns detected. Falling back to default column set');
      insertCols.push('id','warehouseId','holderName','bankName','accountNumber','chartAccountId','openingBalance','contactNumber','bankAddress','createdBy','shopId','createdAt','updatedAt','syncedAt');
    }

    const placeholders = insertCols.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO bank_accounts (${insertCols.join(', ')}) VALUES (${placeholders});`;

    // Debug logging for troubleshooting SQL construction errors
    console.log('[localDatabase.saveBankAccounts] Detected table columns:', cols.join(', '));
    console.log('[localDatabase.saveBankAccounts] Using insertCols:', insertCols.join(', '));
    console.log('[localDatabase.saveBankAccounts] SQL:', sql);

    // Insert each account mapping to available columns
    for (const [idx, account] of bankAccounts.entries()) {
      let values = insertCols.map((col) => {
        switch (col) {
          case 'id': return account.id;
          case 'warehouseId': return String(account.warehouse_id);
          case 'holderName': return account.holder_name;
          case 'bankName': return account.bank_name;
          case 'name': // legacy: prefer holder_name, fall back to bank_name, ensure non-empty to satisfy NOT NULL
            return (account.holder_name || account.bank_name || '').toString();
          case 'accountNumber': return account.account_number;
          case 'chartAccountId': return String(account.chart_account_id);
          case 'openingBalance': return String(account.opening_balance);
          case 'contactNumber': return account.contact_number;
          case 'bankAddress': return account.bank_address;
          case 'createdBy': return String(account.created_by);
          case 'shopId': return account.shop_id;
          case 'createdAt': return account.created_at;
          case 'updatedAt': return account.updated_at;
          case 'syncedAt': return String(syncedAt);
          default: return null;
        }
      });

      // Ensure values length matches insertCols length to avoid SQL syntax errors
      if (values.length !== insertCols.length) {
        console.warn('[localDatabase.saveBankAccounts] Mismatch between insertCols and values lengths', { insertColsLength: insertCols.length, valuesLength: values.length });
        // If shorter, pad with empty strings; if longer, truncate
        if (values.length < insertCols.length) {
          values = values.concat(new Array(insertCols.length - values.length).fill(''));
        } else if (values.length > insertCols.length) {
          values = values.slice(0, insertCols.length);
        }
      }

      if (verboseLogging || idx === 0) {
        console.log('[localDatabase.saveBankAccounts] inserting values sample (first 10):', values.slice(0, 10));
      }

      try {
        await execSql(sql, values);
      } catch (e) {
        console.error('[localDatabase.saveBankAccounts] Failed to insert account:', account, 'SQL:', sql, 'Values length:', values.length, 'InsertCols length:', insertCols.length, 'Error:', e);
        throw e;
      }
    }

    if (verboseLogging) console.info(`[localDatabase] Saved ${bankAccounts.length} bank accounts`);
  } catch (error) {
    console.error('[localDatabase] saveBankAccounts failed:', error);
    throw error;
  }
}

export async function getBankAccounts(warehouseId?: number): Promise<BankAccountRow[]> {
  try {
    let sql = `SELECT * FROM bank_accounts`;
    const args: any[] = [];
    
    if (warehouseId !== undefined) {
      sql += ` WHERE warehouseId = ?`;
      args.push(warehouseId);
    }
    
    sql += ` ORDER BY bankName ASC;`;
    
    const res: any = await execSql(sql, args);
    const accounts: BankAccountRow[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      accounts.push(res.rows.item(i));
    }
    return accounts;
  } catch (error) {
    console.error('[localDatabase] getBankAccounts failed:', error);
    return [];
  }
}

export async function getBankAccountById(accountId: number): Promise<BankAccountRow | null> {
  try {
    const res: any = await execSql(`SELECT * FROM bank_accounts WHERE id = ?;`, [accountId]);
    return res.rows.length > 0 ? res.rows.item(0) : null;
  } catch (error) {
    console.error('[localDatabase] getBankAccountById failed:', error);
    return null;
  }
}

export async function clearAllBankAccounts() {
  await execSql(`DELETE FROM bank_accounts;`);
}

// ============================================================================
// Invoice Items CRUD
// ============================================================================

export async function addInvoiceItem(item: Partial<InvoiceItemRow>): Promise<InvoiceItemRow> {
  const id = item.id ?? `item_${Date.now()}_${Math.random()}`;
  const now = new Date().toISOString();
  
  const row: InvoiceItemRow = {
    id,
    invoiceId: item.invoiceId!,
    productId: item.productId!,
    productName: item.productName,
    quantity: item.quantity!,
    price: item.price!,
    discount: item.discount ?? 0,
    tax: item.tax ?? 0,
    description: item.description,
    shopId: item.shopId,
    createdAt: item.createdAt ?? now,
  };

  await execSql(
    `INSERT INTO invoice_items (id, invoiceId, productId, productName, quantity, price, discount, tax, description, shopId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [row.id, row.invoiceId, row.productId, row.productName, row.quantity, row.price, row.discount, row.tax, row.description, row.shopId, row.createdAt]
  );

  return row;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItemRow[]> {
  const res: any = await execSql(
    `SELECT * FROM invoice_items WHERE invoiceId = ? ORDER BY createdAt ASC;`,
    [invoiceId]
  );
  const items: InvoiceItemRow[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    items.push(res.rows.item(i));
  }
  return items;
}

export async function deleteInvoiceItems(invoiceId: string): Promise<void> {
  await execSql(`DELETE FROM invoice_items WHERE invoiceId = ?;`, [invoiceId]);
}

// ============================================================================
// Invoice Payments CRUD
// ============================================================================

export async function addInvoicePayment(payment: Partial<InvoicePaymentRow>): Promise<InvoicePaymentRow> {
  const id = payment.id ?? `payment_${Date.now()}_${Math.random()}`;
  const now = new Date().toISOString();
  
  const row: InvoicePaymentRow = {
    id,
    invoiceId: payment.invoiceId!,
    amount: payment.amount!,
    accountId: payment.accountId!,
    accountName: payment.accountName,
    paymentMethod: payment.paymentMethod,
    date: payment.date!,
    reference: payment.reference,
    createdAt: payment.createdAt ?? now,
  };

  await execSql(
    `INSERT INTO invoice_payments (id, invoiceId, amount, accountId, accountName, paymentMethod, date, reference, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [row.id, row.invoiceId, row.amount, row.accountId, row.accountName, row.paymentMethod, row.date, row.reference, row.createdAt]
  );

  return row;
}

export async function getInvoicePayments(invoiceId: string): Promise<InvoicePaymentRow[]> {
  const res: any = await execSql(
    `SELECT * FROM invoice_payments WHERE invoiceId = ? ORDER BY date ASC;`,
    [invoiceId]
  );
  const payments: InvoicePaymentRow[] = [];
  for (let i = 0; i < res.rows.length; i++) {
    payments.push(res.rows.item(i));
  }
  return payments;
}

export async function deleteInvoicePayments(invoiceId: string): Promise<void> {
  await execSql(`DELETE FROM invoice_payments WHERE invoiceId = ?;`, [invoiceId]);
}

export default {
  initDB,
  addCustomer,
  getCustomers,
  getUnsynced,
  markAsSynced,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  markCustomerAsError,
  clearAllCustomers,
  upsertCustomer,
  addInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getUnsyncedInvoices,
  markInvoiceAsSynced,
  markInvoiceAsFailed,
  clearAllInvoices,
  upsertInvoice,
  updateInvoicesCustomerId,
  saveDealers,
  getDealers,
  clearAllDealers,
  saveBankAccounts,
  getBankAccounts,
  getBankAccountById,
  clearAllBankAccounts,
  addInvoiceItem,
  getInvoiceItems,
  deleteInvoiceItems,
  addInvoicePayment,
  getInvoicePayments,
  deleteInvoicePayments,
};
