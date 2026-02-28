import { openDB, type IDBPDatabase } from "idb";

interface LKPharmaCareDB {
  "offline-sales": {
    key: string;
    value: {
      id: string;
      items: Array<{
        medicine_id: string;
        name: string;
        quantity: number;
        unit_price: number;
      }>;
      total_amount: number;
      payment_method: string;
      branch_id: string;
      created_at: string;
      synced: boolean;
    };
    indexes: { "by-synced": boolean };
  };
  "cached-medicines": {
    key: string;
    value: {
      id: string;
      name: string;
      generic_name: string | null;
      category: string;
      unit_price: number;
      quantity_in_stock: number;
      barcode: string | null;
      branch_id: string;
      dispensing_unit: string | null;
      brand: string | null;
      updated_at: string;
    };
  };
  "sync-queue": {
    key: number;
    value: {
      id?: number;
      action: string;
      payload: Record<string, unknown>;
      created_at: string;
      retries: number;
    };
    indexes: { "by-action": string };
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export function getDB(): Promise<IDBPDatabase<any>> {
  if (!dbPromise) {
    dbPromise = openDB<LKPharmaCareDB>("lk-pharmacare", 1, {
      upgrade(db) {
        // Offline sales store
        const salesStore = db.createObjectStore("offline-sales", {
          keyPath: "id",
        });
        salesStore.createIndex("by-synced", "synced");

        // Cached medicines store
        db.createObjectStore("cached-medicines", { keyPath: "id" });

        // Sync queue
        const queueStore = db.createObjectStore("sync-queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        queueStore.createIndex("by-action", "action");
      },
    });
  }
  return dbPromise;
}

// Offline sales helpers
export async function saveOfflineSale(
  sale: LKPharmaCareDB["offline-sales"]["value"],
) {
  const db = await getDB();
  await db.put("offline-sales", sale);
}

export async function getUnsyncedSales() {
  const db = await getDB();
  return db.getAllFromIndex("offline-sales", "by-synced", false);
}

export async function markSaleSynced(id: string) {
  const db = await getDB();
  const sale = await db.get("offline-sales", id);
  if (sale) {
    sale.synced = true;
    await db.put("offline-sales", sale);
  }
}

// Medicine cache helpers
export async function cacheMedicines(
  medicines: LKPharmaCareDB["cached-medicines"]["value"][],
) {
  const db = await getDB();
  const tx = db.transaction("cached-medicines", "readwrite");
  await tx.store.clear();
  for (const med of medicines) {
    await tx.store.put(med);
  }
  await tx.done;
}

export async function getCachedMedicines() {
  const db = await getDB();
  return db.getAll("cached-medicines");
}

// Sync queue helpers
export async function addToSyncQueue(action: string, payload: any) {
  const db = await getDB();
  await db.add("sync-queue", {
    action,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  });
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAll("sync-queue");
}

export async function removeFromSyncQueue(id: number) {
  const db = await getDB();
  await db.delete("sync-queue", id);
}

export async function clearSyncQueue() {
  const db = await getDB();
  const tx = db.transaction("sync-queue", "readwrite");
  await tx.store.clear();
  await tx.done;
}

/**
 * Search cached medicines locally (used when server is unreachable).
 * Matches against name, generic_name, brand, and barcode.
 */
export async function searchCachedMedicines(query: string) {
  const db = await getDB();
  const all = await db.getAll("cached-medicines");
  const q = query.toLowerCase().trim();
  if (!q) return all.slice(0, 40);
  return all.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.generic_name ?? "").toLowerCase().includes(q) ||
      (m.brand ?? "").toLowerCase().includes(q) ||
      (m.barcode ?? "").toLowerCase().includes(q),
  );
}

/** Count how many medicines are in the local cache. */
export async function getCachedMedicineCount(): Promise<number> {
  const db = await getDB();
  return db.count("cached-medicines");
}
