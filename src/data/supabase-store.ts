import type { SupabaseClient } from "@supabase/supabase-js";
import type { Budget, Category, Expense } from "@/domain/types";
import type { Collection, Repository, Store } from "./repositories";
import {
  budgetFromRow,
  categoryFromRow,
  expenseFromRow,
  preferencesFromRow,
  preferencesToRow,
  toRow,
  type BudgetRow,
  type CategoryRow,
  type ExpenseRow,
  type PreferencesRow,
} from "./supabase-mappers";

type Change = { collection: Collection; op: "put"; row: unknown } | { collection: Collection; op: "delete"; id: string };

/** PostgREST returns at most 1000 rows per request, so lists are paged. */
const PAGE = 1000;

function fail(action: string, error: { message: string }): never {
  throw new Error(`Couldn't ${action}: ${error.message}`);
}

/**
 * Cloud store for a signed-in account. Reads go straight to the tables;
 * every write goes through the `apply_changes` RPC so multi-record changes
 * are atomic. RLS scopes everything to the signed-in user.
 */
export function createSupabaseStore(db: SupabaseClient, userId: string): Store {
  async function apply(changes: Change[]): Promise<void> {
    if (!changes.length) return;
    const { error } = await db.rpc("apply_changes", { changes });
    if (error) fail("save your changes", error);
  }

  function repository<T extends { id: string }, R>(collection: Collection, fromRow: (r: R) => T): Repository<T> {
    return {
      async list() {
        const out: T[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await db
            .from(collection)
            .select("*")
            .order("id")
            .range(from, from + PAGE - 1);
          if (error) fail(`load ${collection}`, error);
          out.push(...(data as R[]).map(fromRow));
          if (data.length < PAGE) return out;
        }
      },
      async get(id) {
        const { data, error } = await db.from(collection).select("*").eq("id", id).maybeSingle();
        if (error) fail(`load ${collection}`, error);
        return data ? fromRow(data as R) : undefined;
      },
      put: (item) => apply([{ collection, op: "put", row: toRow(collection, item) }]),
      putMany: (items) => apply(items.map((item) => ({ collection, op: "put", row: toRow(collection, item) }))),
      delete: (id) => apply([{ collection, op: "delete", id }]),
    };
  }

  const expenses = repository<Expense, ExpenseRow>("expenses", expenseFromRow);
  const budgets = repository<Budget, BudgetRow>("budgets", budgetFromRow);
  const categories = repository<Category, CategoryRow>("categories", categoryFromRow);

  return {
    expenses,
    budgets,
    categories,
    preferences: {
      async get() {
        const { data, error } = await db.from("preferences").select("default_currency, locale, timezone").maybeSingle();
        if (error) fail("load your preferences", error);
        return data ? preferencesFromRow(data as PreferencesRow) : undefined;
      },
      async set(p) {
        const { error } = await db.from("preferences").upsert({ user_id: userId, ...preferencesToRow(p) });
        if (error) fail("save your preferences", error);
      },
    },
    persistent: true,
    async clear() {
      const [e, b, c] = await Promise.all([expenses.list(), budgets.list(), categories.list()]);
      await apply([
        ...e.map((x) => ({ collection: "expenses" as const, op: "delete" as const, id: x.id })),
        ...b.map((x) => ({ collection: "budgets" as const, op: "delete" as const, id: x.id })),
        ...c.map((x) => ({ collection: "categories" as const, op: "delete" as const, id: x.id })),
      ]);
    },
    async transaction(write) {
      const changes: Change[] = [];
      write({
        put: (collection, item) => changes.push({ collection, op: "put", row: toRow(collection, item) }),
        delete: (collection, id) => changes.push({ collection, op: "delete", id }),
      });
      await apply(changes);
    },
  };
}
