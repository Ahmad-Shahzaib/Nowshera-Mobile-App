import * as SQLite from "expo-sqlite";

const DB_NAME = 'naushera.db';

const anySQLite = SQLite as any;
let db =
  anySQLite.openDatabaseSync?.(DB_NAME) ??
  anySQLite.openDatabase?.(DB_NAME) ??
  (anySQLite.openDatabaseAsync ? null : null);

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
  createdAt: string;
  updatedAt: string;
  synced: number;
};

async function execSql<T = any>(sql: string, args: any[] = []): Promise<T> {
  const anyDb = db as any;

  if (typeof anyDb?.transaction === "function") {
    return new Promise((resolve, reject) => {
      anyDb.transaction((tx: any) => {
        tx.executeSql(
          sql,
          args,
          (_tx: any, res: any) => resolve(res),
          (_tx: any, err: any) => {
            reject(err);
            return false;
          }
        );
      });
    });
  }

  if (typeof anyDb?.runAsync === "function") {
    const result = await anyDb.runAsync(sql, ...args);
    const rowsArr = await result.getAllAsync();
    return {
      rows: {
        length: rowsArr.length,
        item: (i: number) => rowsArr[i],
      },
      insertId: (result as any).lastInsertRowId,
      rowsAffected: (result as any).changes,
    } as any;
  }

  if (typeof anyDb?.runSync === "function") {
    const result = anyDb.runSync(sql, ...args);
    const rowsArr = result.getAllSync();
    return {
      rows: {
        length: rowsArr.length,
        item: (i: number) => rowsArr[i],
      },
      insertId: result.lastInsertRowId,
      rowsAffected: result.changes,
    } as any;
  }

  if (typeof anyDb?.execAsync === "function") {
    await anyDb.execAsync(sql);
    return { rows: { length: 0, item: () => null } } as any;
  }

  if (typeof anyDb?.execSync === "function") {
    anyDb.execSync(sql);
    return { rows: { length: 0, item: () => null } } as any;
  }

  if (anySQLite.openDatabaseAsync && !anyDb) {
    const opened = await anySQLite.openDatabaseAsync(DB_NAME);
    db = opened;
    return execSql(sql, args);
  }

  throw new Error("No compatible SQLite API found at runtime");
}

export async function initDB() {
  await execSql(
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY NOT NULL,
      serverId TEXT,
      name TEXT,
      contact TEXT,
      email TEXT,
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
    `INSERT INTO customers (id, serverId, name, contact, email, taxNumber, openingBalance, address, city, state, country, zip, createdAt, updatedAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      row.id,
      row.serverId,
      row.name,
      row.contact,
      row.email,
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

export default {
  initDB,
  addCustomer,
  getCustomers,
  getUnsynced,
  markAsSynced,
  updateCustomer,
  deleteCustomer,
};
