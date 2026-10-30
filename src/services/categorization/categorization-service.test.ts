import { describe, expect, it } from "vitest";
import { seedCategories } from "@/data/seed";
import type { Category } from "@/domain/types";
import { LocalCategorizationService } from "./categorization-service";

const svc = new LocalCategorizationService();
const cats = seedCategories();

describe("local categorization", () => {
  it("matches keywords (merchant names)", () => {
    expect(svc.categorize({ description: "Weekly shop", merchant: "Rimi" }, cats)).toMatchObject({
      categoryId: "cat-groceries",
      confidence: "high",
    });
  });

  it("matches category names with simple plurals", () => {
    expect(svc.categorize({ description: "Groceries", merchant: null }, cats).categoryId).toBe("cat-groceries");
    expect(svc.categorize({ description: "Coffee", merchant: null }, cats).categoryId).toBe("cat-coffee");
    expect(svc.categorize({ description: "Lunch", merchant: null }, cats).categoryId).toBe("cat-dining");
  });

  it("uses description words as a weaker signal", () => {
    const custom: Category[] = [
      ...cats,
      {
        id: "cat-pets",
        name: "Pets",
        description: "Vet visits and kibble for the dog.",
        keywords: [],
        icon: "🐾",
        isSystem: false,
        createdAt: "",
        updatedAt: "",
      },
    ];
    expect(svc.categorize({ description: "Kibble bag", merchant: null }, custom)).toMatchObject({
      categoryId: "cat-pets",
      confidence: "medium",
    });
  });

  it("falls back to Uncategorized when unsure", () => {
    expect(svc.categorize({ description: "Market flowers", merchant: null }, cats).categoryId).toBeNull();
    expect(svc.categorize({ description: "", merchant: null }, cats).categoryId).toBeNull();
  });

  it("falls back on ties", () => {
    const tie: Category[] = [
      { ...cats[0]!, id: "a", name: "A", keywords: ["thing"], description: "" },
      { ...cats[0]!, id: "b", name: "B", keywords: ["thing"], description: "" },
    ];
    expect(svc.categorize({ description: "thing", merchant: null }, tie)).toMatchObject({ categoryId: null, reason: "Ambiguous match" });
  });
});
