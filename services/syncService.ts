import localDB from './localDatabase';

export type SyncResult = {
  success: boolean;
  syncedCount: number;
  error?: string;
};

/**
 * syncUnsynced
 * - If apiUrl is provided, POST unsynced customers to that endpoint
 * - If no apiUrl provided, we simulate success (useful for demo)
 * - On success, mark local rows as synced
 */
export async function syncUnsynced(apiUrl?: string): Promise<SyncResult> {
  try {
    const unsynced = await localDB.getUnsynced();
    if (unsynced.length === 0) return { success: true, syncedCount: 0 };

    if (!apiUrl) {
      // No server configured — simulate a successful sync for demo
      for (const row of unsynced) {
        await localDB.markAsSynced(row.id, `simulated-${row.id}`);
      }
      return { success: true, syncedCount: unsynced.length };
    }

    // try bulk POST: expect server to accept array of customers
    const payload = unsynced.map((r) => ({
      localId: r.id,
      name: r.name,
      contact: r.contact,
      email: r.email,
      taxNumber: r.taxNumber,
      openingBalance: r.openingBalance,
      address: r.address,
      city: r.city,
      state: r.state,
      country: r.country,
      zip: r.zip,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers: payload }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, syncedCount: 0, error: `Server responded ${res.status}: ${text}` };
    }

    // expect response to include mapping of localId -> serverId, else mark all as synced
    const json = await res.json().catch(() => null);

    if (json && Array.isArray(json.synced)) {
      // server returned an array of { localId, serverId }
      for (const s of json.synced) {
        await localDB.markAsSynced(s.localId, s.serverId);
      }
      return { success: true, syncedCount: json.synced.length };
    }

    // fallback: mark all as synced and attach simulated serverIds
    for (const row of unsynced) {
      await localDB.markAsSynced(row.id, `server_${Date.now()}_${row.id}`);
    }

    return { success: true, syncedCount: unsynced.length };
  } catch (err: any) {
    return { success: false, syncedCount: 0, error: String(err?.message ?? err) };
  }
}

export default { syncUnsynced };
