import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetsScreen } from "@/components/budgets/budgets-screen";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return (
    <Suspense>
      <BudgetsScreen />
    </Suspense>
  );
}
