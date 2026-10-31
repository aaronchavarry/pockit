import type { Preferences } from "@/domain/types";
import type { Collection, Repository, Store, StoreWrites } from "./repositories";

/**
 * IndexedDB persistence. The database name is namespaced to the demo so
 * future real-user data never mixes with seeded demo data.
 */
export const DB_NAME = "pockit-demo";
export const DB_VERSION = 2;

const COLLECTIONS: readonly Collection[] = ["expenses", "budgets", "categories"];
const META = "meta";

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export function openDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // Versioned migrations: add `if (event.oldVersion < N)` blocks for future schema changes.
      if (event.oldVersion < 1) {
        for (const name of COLLECTIONS) db.createObjectStore(name, { keyPath: "id" });
        db.createObjectStore(META);
      }
      if (event.oldVersion >= 1 && event.oldVersion < 2) {
        // v2: expenses gain countsTowardBudget (default true).
        const store = req.transaction!.objectStore("expenses");
        store.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          if (cursor.value.countsTowardBudget === undefined) cursor.update({ ...cursor.value, countsTowardBudget: true });
          cursor.continue();
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Database is blocked by another tab."));
  });
}

class IdbRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly db: IDBDatabase,
    private readonly name: Collection,
  ) {}

  async list(): Promise<T[]> {
    const tx = this.db.transaction(this.name, "readonly");
    return promisify(tx.objectStore(this.name).getAll() as IDBRequest<T[]>);
  }

  async get(id: string): Promise<T | undefined> {
    const tx = this.db.transaction(this.name, "readonly");
    return promisify(tx.objectStore(this.name).get(id) as IDBRequest<T | undefined>);
  }

  async put(item: T): Promise<void> {
    await this.putMany([item]);
  }

  async putMany(items: readonly T[]): Promise<void> {
    const tx = this.db.transaction(this.name, "readwrite");
    const store = tx.objectStore(this.name);
    for (const item of items) store.put(item);
    await txDone(tx);
  }

  async delete(id: string): Promise<void> {
    const tx = this.db.transaction(this.name, "readwrite");
    tx.objectStore(this.name).delete(id);
    await txDone(tx);
  }
}

export function createIndexedDbStore(db: IDBDatabase): Store {
  return {
    expenses: new IdbRepository(db, "expenses"),
    budgets: new IdbRepository(db, "budgets"),
    categories: new IdbRepository(db, "categories"),
    preferences: {
      async get() {
        const tx = db.transaction(META, "readonly");
        return promisify(tx.objectStore(META).get("preferences") as IDBRequest<Preferences | undefined>);
      },
      async set(prefs) {
        const tx = db.transaction(META, "readwrite");
        tx.objectStore(META).put(prefs, "preferences");
        await txDone(tx);
      },
    },
    persistent: true,
    async clear() {
      const tx = db.transaction([...COLLECTIONS, META], "readwrite");
      for (const name of [...COLLECTIONS, META]) tx.objectStore(name).clear();
      await txDone(tx);
    },
    async transaction(write) {
      const tx = db.transaction([...COLLECTIONS], "readwrite");
      const writes: StoreWrites = {
        put: (collection, item) => void tx.objectStore(collection).put(item),
        delete: (collection, id) => void tx.objectStore(collection).delete(id),
      };
      write(writes);
      await txDone(tx);
    },
  };
}
