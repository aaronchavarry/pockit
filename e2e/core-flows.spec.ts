import { expect, test, type Page } from "@playwright/test";

const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
});

test.afterEach(() => {
  expect(consoleErrors, "no console errors").toEqual([]);
});

async function enterDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Try demo" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Expenses", level: 1 })).toBeVisible();
}

async function spentFigure(page: Page) {
  return (await page.getByLabel("Spending summary").locator("p").first().innerText()).replace(/\s+/g, "");
}

async function openAdd(page: Page) {
  const fab = page.getByRole("button", { name: "Add expense" }).filter({ visible: true }).first();
  await fab.click();
  await expect(page.getByRole("dialog", { name: "Add expense" })).toBeVisible();
}

test("entry screen: demo works, Google is real or visibly unavailable", async ({ page }) => {
  await page.goto("/");
  const google = page.getByRole("button", { name: /Continue with Google/ });
  // Builds without Supabase config show "Coming soon"; configured builds offer real sign-in.
  // Either way it must never fake a signed-in state on this screen.
  if (await google.isDisabled()) await expect(google).toContainText("Coming soon");
  else await expect(page.getByRole("button", { name: /Open my Pockit/ })).toHaveCount(0);
  await expect(page.getByText(/sample data/)).toBeVisible();
  await enterDemo(page);
  await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
  await expect(page.getByText("Groceries").first()).toBeVisible();
});

test("natural-language add updates Home, then edit and delete", async ({ page }) => {
  await enterDemo(page);
  const before = await spentFigure(page);

  await openAdd(page);
  await page.getByLabel("What did you spend?").fill("Paid 12 USD for lunch");
  await page.getByRole("dialog").getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Added", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("US$12.00");
  await expect(page.getByRole("dialog")).toContainText("Dining");
  await page.getByRole("button", { name: "Done" }).click();

  const afterAdd = await spentFigure(page);
  expect(afterAdd).not.toBe(before);
  const recent = page.getByRole("button", { name: /^Lunch, US\$12\.00/ }).first();
  await expect(recent).toBeVisible();

  // Edit
  await recent.click();
  await expect(page.getByRole("dialog", { name: "Edit expense" })).toBeVisible();
  await page.getByLabel("Amount").fill("20");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("button", { name: /^Lunch, US\$20\.00/ }).first()).toBeVisible();
  expect(await spentFigure(page)).not.toBe(afterAdd);

  // Persisted across reload
  await page.reload();
  await expect(page.getByRole("button", { name: /^Lunch, US\$20\.00/ }).first()).toBeVisible();

  // Delete with confirmation
  await page.getByRole("button", { name: /^Lunch, US\$20\.00/ }).first().click();
  await page.getByRole("button", { name: "Delete expense" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: /^Lunch, US\$20\.00/ })).toHaveCount(0);
  expect(await spentFigure(page)).toBe(before);
});

test("missing amount does not create an expense", async ({ page }) => {
  await enterDemo(page);
  await openAdd(page);
  await page.getByLabel("What did you spend?").fill("Lunch at Vapiano");
  await page.getByRole("dialog").getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("How much was it?");
});

test("form entry validates and saves", async ({ page }) => {
  await enterDemo(page);
  await openAdd(page);
  await page.getByRole("tab", { name: "Fill a form" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Enter an amount.")).toBeVisible();
  await expect(page.getByText("Add a short description.")).toBeVisible();
  await page.getByLabel("Amount").fill("7.25");
  await page.getByLabel("Description").fill("Cinema popcorn");
  await page.getByRole("dialog").getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("button", { name: /^Cinema popcorn/ }).first()).toBeVisible();
});

test("week / month toggle changes the period", async ({ page }) => {
  await enterDemo(page);
  const month = await spentFigure(page);
  await page.getByRole("radio", { name: "week" }).click();
  await expect(page.getByRole("radio", { name: "week" })).toHaveAttribute("aria-checked", "true");
  expect(await spentFigure(page)).not.toBe(month);
});

test("expenses list: search and category filter", async ({ page }) => {
  await enterDemo(page);
  await page.getByRole("link", { name: "Expenses" }).filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Expenses", level: 1 })).toBeVisible();
  await page.getByLabel("Search expenses").fill("rimi");
  const rows = page.locator("main li button");
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain("rimi");
  await page.goto("/expenses?category=none");
  await expect(page.getByRole("button", { name: /^Market flowers/ })).toBeVisible();
});

test("budgets: create a category budget, see conflicts", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/budgets");
  await expect(page.getByRole("heading", { name: "Budgets", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /New/ }).first().click();
  await page.getByLabel("Limit").fill("500");
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("overlaps");

  await page.getByText("One category").click();
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "🚌 Transport" });
  await page.getByRole("button", { name: "Create budget" }).click();
  await expect(page.getByText("Transport · Monthly")).toBeVisible();
});

test("categories: create, then delete without losing expenses", async ({ page }) => {
  await enterDemo(page);
  await page.goto("/categories");
  await page.getByRole("button", { name: /New/ }).first().click();
  await page.getByLabel("Name").fill("groceries");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("A category with this name already exists.")).toBeVisible();
  await page.getByLabel("Name").fill("Pets");
  await page.getByRole("textbox", { name: /Keywords/ }).fill("Zooplus, vet");
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByRole("heading", { name: "Pets" })).toBeVisible();

  const card = page.locator("li", { has: page.getByRole("heading", { name: "Coffee" }) });
  await card.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "Coffee" })).toHaveCount(0);
  await page.goto("/expenses");
  await expect(page.getByRole("button", { name: /^Flat white/ })).toBeVisible();
});

test("reset demo restores seed data", async ({ page }) => {
  await enterDemo(page);
  const seeded = await spentFigure(page);
  await openAdd(page);
  await page.getByLabel("What did you spend?").fill("Coffee 100");
  await page.getByRole("dialog").getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  expect(await spentFigure(page)).not.toBe(seeded);

  await page.getByRole("button", { name: "Demo mode" }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Reset demo data…" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect.poll(() => spentFigure(page)).toBe(seeded);
});

test("works offline after first load", async ({ page, context }) => {
  await enterDemo(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  // Network failures for uncached RSC prefetches are expected while offline.
  page.on("console", () => consoleErrors.splice(0, consoleErrors.length, ...consoleErrors.filter((e) => !e.includes("ERR_INTERNET_DISCONNECTED"))));
  await page.goto("/budgets");
  await expect(page.getByRole("heading", { name: "Budgets", level: 1 })).toBeVisible();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Expenses", level: 1 })).toBeVisible();
  await context.setOffline(false);
});

test("no horizontal overflow on any screen", async ({ page }) => {
  await enterDemo(page);
  for (const path of ["/", "/home", "/expenses", "/budgets", "/categories"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const { scroll, client } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(scroll, `overflow on ${path}`).toBeLessThanOrEqual(client);
  }
});
