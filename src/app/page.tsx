import type { Metadata } from "next";
import { EntryActions } from "@/components/layout/entry-actions";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Welcome" };

export default function EntryPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <Logo />

      <section className="flex flex-1 flex-col justify-center py-12">
        <h1 className="text-[2.4rem] leading-[1.08] font-semibold tracking-tight text-ink">
          Know where your
          <br />
          money goes.
        </h1>
        <p className="mt-4 max-w-sm text-[1.05rem] leading-relaxed text-ink-2">
          Log an expense in a few words. See your week and month at a glance. Stay inside your budget without
          spreadsheets.
        </p>

        <div aria-hidden="true" className="mt-10 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-medium tracking-tight tabular">842.30</span>
            <span className="text-sm text-ink-3 tabular">/1,200</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-track">
            <div className="h-full w-[70%] rounded-full bg-teal" />
          </div>
          <p className="mt-3 text-sm text-ink-3">“Lunch 12.50 at Vapiano” → added to Dining</p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <EntryActions />
        <p className="mt-2 text-center text-sm leading-relaxed text-ink-3">
          The demo uses sample data and runs entirely on this device. Nothing from the demo is sent anywhere.
        </p>
      </div>
    </main>
  );
}
