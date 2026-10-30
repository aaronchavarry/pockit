import type { Budget, Category, Expense, Preferences } from "@/domain/types";

/** Generic keyed collection. Implementations: IndexedDB (default), memory (fallback/tests). */
export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<void>;
  putMany(items: readonly T[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export type ExpenseRepository = Repository<Expense>;
export type BudgetRepository = Repository<Budget>;
export type CategoryRepository = Repository<Category>;

export interface PreferencesRepository {
  get(): Promise<Preferences | undefined>;
  set(prefs: Preferences): Promise<void>;
}

export interface Store {
  expenses: ExpenseRepository;
  budgets: BudgetRepository;
  categories: CategoryRepository;
  preferences: PreferencesRepository;
  /** Whether data survives a reload. False for the in-memory fallback. */
  persistent: boolean;
  /** Wipes every collection (used by "Reset demo data"). */
  clear(): Promise<void>;
  /**
   * Runs `write` atomically across collections where supported, so that
   * multi-record changes (e.g. budget versioning) are all-or-nothing.
   */
  transaction(write: (tx: StoreWrites) => void): Promise<void>;
}

export interface StoreWrites {
  put(collection: Collection, item: { id: string }): void;
  delete(collection: Collection, id: string): void;
}

export type Collection = "expenses" | "budgets" | "categories";
