"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createIndexedDbStore, openDatabase } from "@/data/indexeddb-store";
import { createMemoryStore } from "@/data/memory-store";
import type { Store } from "@/data/repositories";
import { seedBudgets, seedCategories, seedExpenses, seedPreferences } from "@/data/seed";
import type { Budget, Category, Expense, Preferences } from "@/domain/types";
import { deviceTimeZone, today as todayIn, type PlainDate } from "@/lib/dates";

export interface AppData {
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  preferences: Preferences;
}

interface DataContextValue {
  status: "loading" | "ready" | "error";
  error: string | null;
  data: AppData | null;
  store: Store | null;
  today: PlainDate;
  persistent: boolean;
  /** Runs a mutation against the store, then reloads data. */
  mutate: <T>(fn: (store: Store) => Promise<T>) => Promise<T>;
  resetDemo: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export async function seedDemo(store: Store, timezone: string): Promise<void> {
  const t = todayIn(timezone);
  await store.clear();
  await store.categories.putMany(seedCategories());
  await store.budgets.putMany(seedBudgets(t));
  await store.expenses.putMany(seedExpenses(t, timezone));
  await store.preferences.set(seedPreferences(timezone));
}

/** First sign-in to an account: built-in categories and preferences only, no sample data. */
export async function seedAccount(store: Store, timezone: string): Promise<void> {
  await store.categories.putMany(seedCategories());
  await store.preferences.set(seedPreferences(timezone));
}

async function loadAll(store: Store): Promise<AppData | null> {
  const [expenses, budgets, categories, preferences] = await Promise.all([
    store.expenses.list(),
    store.budgets.list(),
    store.categories.list(),
    store.preferences.get(),
  ]);
  if (!preferences) return null;
  categories.sort((a, b) => a.name.localeCompare(b.name));
  return { expenses, budgets, categories, preferences };
}

async function openStore(): Promise<Store> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
    const db = await openDatabase();
    // Ask the browser to keep data under storage pressure (best effort).
    void navigator.storage?.persist?.().catch(() => undefined);
    return createIndexedDbStore(db);
  } catch {
    return createMemoryStore();
  }
}

interface DataProviderProps {
  children: ReactNode;
  storeFactory?: () => Promise<Store>;
  /** Fills an empty store (no preferences yet). Defaults to the demo seed. */
  initialize?: (store: Store, timezone: string) => Promise<void>;
}

export function DataProvider({ children, storeFactory = openStore, initialize = seedDemo }: DataProviderProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [status, setStatus] = useState<DataContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<PlainDate>(() => todayIn());
  const factoryRef = useRef(storeFactory);
  const initializeRef = useRef(initialize);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await factoryRef.current();
        let loaded = await loadAll(s);
        if (!loaded) {
          await initializeRef.current(s, deviceTimeZone());
          loaded = await loadAll(s);
        }
        if (cancelled) return;
        setStore(s);
        setData(loaded);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load your data.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const timezone = data?.preferences.timezone;
  useEffect(() => {
    // Keep "today" correct across midnight and when the tab regains focus.
    const update = () => setToday(todayIn(timezone));
    update();
    const id = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", update);
    };
  }, [timezone]);

  const reload = useCallback(async (s: Store) => {
    const loaded = await loadAll(s);
    if (loaded) setData(loaded);
  }, []);

  const mutate = useCallback(
    async <T,>(fn: (s: Store) => Promise<T>): Promise<T> => {
      if (!store) throw new Error("Data is still loading.");
      try {
        return await fn(store);
      } finally {
        await reload(store);
      }
    },
    [store, reload],
  );

  const resetDemo = useCallback(async () => {
    if (!store) return;
    await seedDemo(store, deviceTimeZone());
    await reload(store);
  }, [store, reload]);

  const value = useMemo<DataContextValue>(
    () => ({ status, error, data, store, today, persistent: store?.persistent ?? true, mutate, resetDemo }),
    [status, error, data, store, today, mutate, resetDemo],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

/** Data once loaded. Use inside screens rendered only when status is "ready". */
export function useReadyData(): AppData & Omit<DataContextValue, "data"> {
  const ctx = useData();
  if (!ctx.data) throw new Error("Data not ready");
  return { ...ctx, ...ctx.data };
}
