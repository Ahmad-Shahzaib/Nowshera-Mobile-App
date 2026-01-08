export async function initDB() {
  console.warn("SQLite not supported on Web.");
  return;
}

export async function addCustomer() {
  console.warn("SQLite not supported on Web.");
  return null;
}

export async function getCustomers() {
  return [];
}

export async function getUnsynced() {
  return [];
}

export async function markAsSynced() {}

export async function updateCustomer() {}

export async function deleteCustomer() {}

export async function dropAllTables() {
  console.warn('SQLite not supported on Web. dropAllTables skipped.');
}

export async function closeDatabase() {
  console.warn('SQLite not supported on Web. closeDatabase skipped.');
}

export default {
  initDB,
  addCustomer,
  getCustomers,
  getUnsynced,
  markAsSynced,
  updateCustomer,
  deleteCustomer,
  dropAllTables,
  closeDatabase,
};
