import type { Budget, Category, Expense, Preferences } from "@/domain/types";
import type { Collection, Repository, Store } from "./repositories";

class MemoryRepository<T extends { id: string }> implements Repository<T> {
  readonly items = new Map<string, T>();

  async list() {
    return [...this.items.values()].map((i) => structuredClone(i));
  }
  async get(id: string) {
    const item = this.items.get(id);
    return item ? structuredClone(item) : undefined;
  }
  async put(item: T) {
    this.items.set(item.id, structuredClone(item));
  }
  async putMany(items: readonly T[]) {
    for (const item of items) this.items.set(item.id, structuredClone(item));
  }
  async delete(id: string) {
    this.items.delete(id);
  }
}

/** Non-persistent store used in tests and when IndexedDB is unavailable. */
export function createMemoryStore(): Store {
  const repos = {
    expenses: new MemoryRepository<Expense>(),
    budgets: new MemoryRepository<Budget>(),
    categories: new MemoryRepository<Category>(),
  } as const;
  let prefs: Preferences | undefined;
  const byName = (c: Collection) => repos[c] as unknown as MemoryRepository<{ id: string }>;

  return {
    expenses: repos.expenses,
    budgets: repos.budgets,
    categories: repos.categories,
    preferences: {
      async get() {
        return prefs ? { ...prefs } : undefined;
      },
      async set(p) {
        prefs = { ...p };
      },
    },
    persistent: false,
    async clear() {
      for (const r of Object.values(repos)) r.items.clear();
      prefs = undefined;
    },
    async transaction(write) {
      // Stage writes, then apply together so a throw leaves state untouched.
      const ops: Array<() => void> = [];
      write({
        put: (c, item) => ops.push(() => byName(c).items.set(item.id, structuredClone(item))),
        delete: (c, id) => ops.push(() => byName(c).items.delete(id)),
      });
      for (const op of ops) op();
    },
  };
}
