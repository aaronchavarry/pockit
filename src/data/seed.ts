import type { Budget, Category, Expense, Preferences } from "@/domain/types";
import { addDays, addMonths, calendarMonth, calendarWeek, type PlainDate } from "@/lib/dates";

/**
 * Demo seed. Dates are relative to "today" so the dashboard always looks
 * current. This is sample data, not anyone's real finances.
 */

const SEED_TS = "2026-01-01T00:00:00.000Z";

type CategorySeed = Pick<Category, "id" | "name" | "description" | "keywords" | "icon">;

export const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  {
    id: "cat-groceries",
    name: "Groceries",
    description: "Supermarket purchases, food shopping and household groceries.",
    keywords: ["Rimi", "Lidl", "Prisma", "Selver", "Maxima", "supermarket", "grocery"],
    icon: "🛒",
  },
  {
    id: "cat-dining",
    name: "Dining",
    description: "Restaurants, takeaway, lunch and dinner out.",
    keywords: ["lunch", "dinner", "restaurant", "burger", "pizza", "sushi", "takeaway", "Wolt", "Bolt Food"],
    icon: "🍔",
  },
  {
    id: "cat-coffee",
    name: "Coffee",
    description: "Coffee shops, cafés and drinks on the go.",
    keywords: ["coffee", "latte", "cappuccino", "espresso", "café", "cafe", "Starbucks", "tea"],
    icon: "☕",
  },
  {
    id: "cat-transport",
    name: "Transport",
    description: "Public transport, taxis, ride sharing, fuel and parking.",
    keywords: ["bus", "tram", "train", "taxi", "Uber", "Bolt", "fuel", "petrol", "parking", "metro", "ticket"],
    icon: "🚌",
  },
  {
    id: "cat-shopping",
    name: "Shopping",
    description: "Clothes, electronics, home goods and online orders.",
    keywords: ["Amazon", "Zara", "IKEA", "H&M", "clothes", "shoes", "headphones"],
    icon: "🛍️",
  },
  {
    id: "cat-bills",
    name: "Bills",
    description: "Rent, utilities, phone, internet and subscriptions.",
    keywords: ["rent", "electricity", "internet", "phone", "Netflix", "Spotify", "subscription", "gym"],
    icon: "💡",
  },
  {
    id: "cat-fun",
    name: "Entertainment",
    description: "Cinema, concerts, games, books and going out.",
    keywords: ["cinema", "movie", "concert", "tickets", "game", "book", "bar", "drinks"],
    icon: "🎬",
  },
  {
    id: "cat-health",
    name: "Health",
    description: "Pharmacy, doctor visits and personal care.",
    keywords: ["pharmacy", "apteek", "doctor", "dentist", "medicine", "vitamins"],
    icon: "💊",
  },
];

export function seedCategories(): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, keywords: [...c.keywords], isSystem: true, createdAt: SEED_TS, updatedAt: SEED_TS }));
}

export function seedPreferences(timezone: string): Preferences {
  return { defaultCurrency: "EUR", locale: "en-IE", timezone };
}

interface ExpenseSeed {
  daysAgo: number;
  amount: number; // minor units
  currency?: string;
  description: string;
  merchant?: string;
  categoryId: string | null;
  time?: string;
  recurrence?: Expense["recurrence"];
}

const EXPENSES: readonly ExpenseSeed[] = [
  { daysAgo: 0, amount: 450, description: "Flat white", merchant: "Kohvik Rost", categoryId: "cat-coffee", time: "08:40" },
  { daysAgo: 0, amount: 2450, description: "Groceries", merchant: "Rimi", categoryId: "cat-groceries", time: "18:15" },
  { daysAgo: 1, amount: 1290, description: "Lunch", merchant: "Vapiano", categoryId: "cat-dining", time: "13:05" },
  { daysAgo: 1, amount: 180, description: "Tram ticket", categoryId: "cat-transport" },
  { daysAgo: 2, amount: 3899, description: "Running shoes", merchant: "Zara", categoryId: "cat-shopping" },
  { daysAgo: 2, amount: 390, description: "Cappuccino", merchant: "Starbucks", categoryId: "cat-coffee" },
  { daysAgo: 3, amount: 1875, description: "Dinner", merchant: "Burger Box", categoryId: "cat-dining" },
  { daysAgo: 3, amount: 4120, description: "Weekly groceries", merchant: "Lidl", categoryId: "cat-groceries" },
  { daysAgo: 4, amount: 1200, currency: "USD", description: "App subscription", merchant: "Notion", categoryId: "cat-bills", recurrence: "monthly" },
  { daysAgo: 5, amount: 950, description: "Taxi home", merchant: "Bolt", categoryId: "cat-transport" },
  { daysAgo: 5, amount: 1500, description: "Cinema tickets", merchant: "Apollo Kino", categoryId: "cat-fun" },
  { daysAgo: 6, amount: 870, description: "Pharmacy", merchant: "Benu", categoryId: "cat-health" },
  { daysAgo: 7, amount: 2260, description: "Groceries", merchant: "Prisma", categoryId: "cat-groceries" },
  { daysAgo: 8, amount: 420, description: "Latte", categoryId: "cat-coffee" },
  { daysAgo: 9, amount: 1599, description: "Netflix", categoryId: "cat-bills", recurrence: "monthly" },
  { daysAgo: 10, amount: 3250, description: "Sushi with friends", merchant: "Sushi Cat", categoryId: "cat-dining" },
  { daysAgo: 11, amount: 1999, currency: "GBP", description: "Book order", merchant: "Waterstones", categoryId: "cat-fun" },
  { daysAgo: 12, amount: 5500, description: "Fuel", merchant: "Circle K", categoryId: "cat-transport" },
  { daysAgo: 13, amount: 3380, description: "Groceries", merchant: "Selver", categoryId: "cat-groceries" },
  { daysAgo: 14, amount: 650, description: "Market flowers", categoryId: null },
  { daysAgo: 15, amount: 2999, description: "Gym membership", categoryId: "cat-bills", recurrence: "monthly" },
  { daysAgo: 16, amount: 1140, description: "Pizza night", merchant: "Pizzakiosk", categoryId: "cat-dining" },
  { daysAgo: 18, amount: 2790, description: "Groceries", merchant: "Rimi", categoryId: "cat-groceries" },
  { daysAgo: 20, amount: 7999, description: "Headphones", merchant: "Amazon", categoryId: "cat-shopping" },
  { daysAgo: 22, amount: 480, description: "Espresso & croissant", categoryId: "cat-coffee" },
  { daysAgo: 24, amount: 3600, description: "Concert tickets", categoryId: "cat-fun" },
  { daysAgo: 26, amount: 2950, description: "Groceries", merchant: "Lidl", categoryId: "cat-groceries" },
  { daysAgo: 29, amount: 65000, description: "Rent", categoryId: "cat-bills", recurrence: "monthly" },
  { daysAgo: 33, amount: 1820, description: "Dinner", merchant: "Vapiano", categoryId: "cat-dining" },
  { daysAgo: 36, amount: 3100, description: "Groceries", merchant: "Prisma", categoryId: "cat-groceries" },
  { daysAgo: 41, amount: 2400, description: "Train tickets", categoryId: "cat-transport" },
  { daysAgo: 45, amount: 4999, description: "Jacket", merchant: "H&M", categoryId: "cat-shopping" },
  { daysAgo: 52, amount: 2650, description: "Groceries", merchant: "Rimi", categoryId: "cat-groceries" },
  { daysAgo: 59, amount: 65000, description: "Rent", categoryId: "cat-bills", recurrence: "monthly" },
];

export function seedExpenses(today: PlainDate, timezone: string): Expense[] {
  return EXPENSES.map((e, i) => ({
    id: `exp-seed-${String(i + 1).padStart(2, "0")}`,
    amountMinor: e.amount,
    currency: e.currency ?? "EUR",
    description: e.description,
    merchant: e.merchant ?? null,
    categoryId: e.categoryId,
    occurredOn: addDays(today, -e.daysAgo),
    occurredTime: e.time ?? null,
    timezone,
    recurrence: e.recurrence ?? "none",
    source: "manual",
    sourceReference: null,
    countsTowardBudget: true,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
  }));
}

function budget(partial: Omit<Budget, "createdAt" | "updatedAt" | "supersedesBudgetId" | "anchorDay" | "endDate" | "closedOn"> & Partial<Budget>): Budget {
  return {
    endDate: null,
    anchorDay: null,
    closedOn: null,
    supersedesBudgetId: null,
    createdAt: SEED_TS,
    updatedAt: SEED_TS,
    ...partial,
  };
}

export function seedBudgets(today: PlainDate): Budget[] {
  const thisMonth = calendarMonth(today).start;
  const threeMonthsAgo = addMonths(thisMonth, -3, 1);
  const lastMonth = addMonths(thisMonth, -1, 1);
  const thisWeek = calendarWeek(today).start;
  const nextMonth = addMonths(thisMonth, 1, 1);

  return [
    // Original monthly budget, replaced by a higher one at the start of last month.
    budget({
      id: "bud-seed-month-v1",
      name: "Monthly budget",
      amountMinor: 140000,
      currency: "EUR",
      scope: "overall",
      categoryId: null,
      periodType: "monthly",
      startDate: threeMonthsAgo,
      effectiveFrom: threeMonthsAgo,
      closedOn: addDays(lastMonth, -1),
    }),
    budget({
      id: "bud-seed-month-v2",
      name: "Monthly budget",
      amountMinor: 160000,
      currency: "EUR",
      scope: "overall",
      categoryId: null,
      periodType: "monthly",
      startDate: threeMonthsAgo,
      effectiveFrom: lastMonth,
      supersedesBudgetId: "bud-seed-month-v1",
    }),
    budget({
      id: "bud-seed-week",
      name: "Weekly budget",
      amountMinor: 30000,
      currency: "EUR",
      scope: "overall",
      categoryId: null,
      periodType: "weekly",
      startDate: addDays(thisWeek, -28),
      effectiveFrom: addDays(thisWeek, -28),
    }),
    budget({
      id: "bud-seed-dining",
      name: "Eating out",
      amountMinor: 15000,
      currency: "EUR",
      scope: "category",
      categoryId: "cat-dining",
      periodType: "monthly",
      startDate: lastMonth,
      effectiveFrom: lastMonth,
    }),
    budget({
      id: "bud-seed-groceries",
      name: "Groceries",
      amountMinor: 30000,
      currency: "EUR",
      scope: "category",
      categoryId: "cat-groceries",
      periodType: "monthly",
      startDate: lastMonth,
      effectiveFrom: lastMonth,
    }),
    budget({
      id: "bud-seed-shopping",
      name: "Shopping",
      amountMinor: 20000,
      currency: "EUR",
      scope: "category",
      categoryId: "cat-shopping",
      periodType: "monthly",
      startDate: lastMonth,
      effectiveFrom: lastMonth,
    }),
    budget({
      id: "bud-seed-trip",
      name: "City trip",
      amountMinor: 60000,
      currency: "EUR",
      scope: "overall",
      categoryId: null,
      periodType: "fixed_range",
      startDate: addDays(nextMonth, 9),
      endDate: addDays(nextMonth, 24),
      effectiveFrom: addDays(nextMonth, 9),
    }),
  ];
}
