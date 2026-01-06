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
    
    // Only run migration check once per session
    if (!dbInitialized) {
      // Check if invoices table needs migration by testing for required columns
      let needsRecreate = false;
      try {
        await execSql(`SELECT warehouseId, subTotal FROM invoices LIMIT 1;`);
      } catch (e: any) {
        // If we get a column error, we need to recreate the table
        if (e?.message?.includes('no column named') || e?.message?.includes('no such column')) {
          needsRecreate = true;
          console.log('[localDatabase] Invoices table schema outdated, recreating...');
        }
      }
      
      if (needsRecreate) {
        // Drop and recreate the invoices table with correct schema
        await execSql(`DROP TABLE IF EXISTS invoices;`);
        console.log('[localDatabase] Dropped old invoices table');
      }
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
      
      // Check if products table needs migration by testing for new columns
      let needsProductsRecreate = false;
      try {
        await execSql(`SELECT name, sale_price, description FROM products LIMIT 1;`);
      } catch (e: any) {
        // If we get a column error, we need to recreate the table
        if (e?.message?.includes('no column named') || e?.message?.includes('no such column')) {
          needsProductsRecreate = true;
          console.log('[localDatabase] Products table schema outdated, recreating...');
        }
      }
      
      if (needsProductsRecreate) {
        // Drop and recreate the products table with correct schema
        await execSql(`DROP TABLE IF EXISTS products;`);
        console.log('[localDatabase] Dropped old products table');
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
        synced INTEGER DEFAULT 0
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
    
    // Create categories table
    await execSql(
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        syncedAt INTEGER
      );`
    );
    
    // Create index on category name for faster search
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);`
    );
    
    // Create warehouses table
    await execSql(
      `CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        syncedAt INTEGER
      );`
    );
    
    // Create index on warehouse name for faster search
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_warehouses_name ON warehouses(name);`
    );
    
    // Create dealers table
    await execSql(
      `CREATE TABLE IF NOT EXISTS dealers (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        syncedAt INTEGER
      );`
    );
    
    // Create index on dealer name for faster search
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_dealers_name ON dealers(name);`
    );
    
    // Create bank_accounts table
    await execSql(
      `CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY NOT NULL,
        warehouseId INTEGER NOT NULL,
        holderName TEXT NOT NULL,
        bankName TEXT NOT NULL,
        accountNumber TEXT NOT NULL,
        chartAccountId INTEGER,
        openingBalance REAL DEFAULT 0,
        contactNumber TEXT,
        bankAddress TEXT,
        createdBy INTEGER,
        shopId INTEGER,
        createdAt TEXT,
        updatedAt TEXT,
        syncedAt INTEGER
      );`
    );
    
    // Create index on bank_accounts for faster filtering by warehouse
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_bank_accounts_warehouse ON bank_accounts(warehouseId);`
    );
    
    // Create invoice_items table for storing invoice line items
    await execSql(
      `CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY NOT NULL,
        invoiceId TEXT NOT NULL,
        productId INTEGER NOT NULL,
        productName TEXT,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        description TEXT,
        shopId INTEGER,
        createdAt TEXT,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );`
    );
    
    // Create index on invoice_items for faster filtering by invoice
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoiceId);`
    );
    
    // Create invoice_payments table for storing payment details
    await execSql(
      `CREATE TABLE IF NOT EXISTS invoice_payments (
        id TEXT PRIMARY KEY NOT NULL,
        invoiceId TEXT NOT NULL,
        amount REAL NOT NULL,
        accountId INTEGER NOT NULL,
        accountName TEXT,
        paymentMethod INTEGER,
        date TEXT NOT NULL,
        reference TEXT,
        createdAt TEXT,
        FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );`
    );
    
    // Create index on invoice_payments for faster filtering by invoice
    await execSql(
      `CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoiceId);`
    );
    
    if (verboseLogging) console.info('[localDatabase] DB initialized');
  } catch (error) {
    console.error('[localDatabase] Failed to initialize DB:', error);
    throw error;
  }
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
  try {
    const id = payload.id ?? `invoice_${Date.now()}`;
    const now = new Date().toISOString();
    const row: InvoiceRow = {
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
    };

    const result = await execSql(
      `INSERT INTO invoices (id, serverId, invoiceNo, customerId, customerName, warehouseId, warehouseName, issueDate, dueDate, subTotal, discountTotal, taxTotal, grandTotal, dueAmount, status, createdAt, updatedAt, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        row.id,
        row.serverId,
        row.invoiceNo,  // This was missing!
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
      ]
    );
    
    console.log('[localDatabase] INSERT result for', row.invoiceNo, ':', result);
    
    // Immediately verify using the same database connection
    try {
      const verifyResult: any = await execSql(`SELECT COUNT(*) as cnt FROM invoices;`);
      console.log('[localDatabase] Total invoices after insert:', verifyResult.rows.length > 0 ? verifyResult.rows.item(0) : 'no result');
    } catch (e) {
      console.error('[localDatabase] Verification query failed:', e);
    }

    return row;
  } catch (error) {
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
  const res: any = await execSql(`SELECT * FROM invoices WHERE synced = 0 ORDER BY createdAt ASC;`);
  const output: InvoiceRow[] = [];
  for (let i = 0; i < res.rows.length; i++) output.push(res.rows.item(i));
  return output;
}

export async function markInvoiceAsSynced(localId: string, serverId?: string) {
  const now = new Date().toISOString();
  await execSql(
    `UPDATE invoices SET synced = 1, serverId = ?, updatedAt = ? WHERE id = ?;`,
    [serverId ?? null, now, localId]
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
        await updateInvoice(localId, { ...invoice, synced: 1 });
        return localId;
      }
    }
    if (invoice.id) {
      const existing = await getInvoiceById(invoice.id);
      if (existing) {
        await updateInvoice(invoice.id, { ...invoice, synced: 1 });
        return invoice.id;
      }
    }
    const row = await addInvoice({ ...invoice, synced: 1 });
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
    
    // Insert new bank accounts
    for (const account of bankAccounts) {
      await execSql(
        `INSERT OR REPLACE INTO bank_accounts (
          id, warehouseId, holderName, bankName, accountNumber, 
          chartAccountId, openingBalance, contactNumber, bankAddress, 
          createdBy, shopId, createdAt, updatedAt, syncedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          account.id,
          account.warehouse_id,
          account.holder_name,
          account.bank_name,
          account.account_number,
          account.chart_account_id,
          account.opening_balance,
          account.contact_number,
          account.bank_address,
          account.created_by,
          account.shop_id,
          account.created_at,
          account.updated_at,
          syncedAt
        ]
      );
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
