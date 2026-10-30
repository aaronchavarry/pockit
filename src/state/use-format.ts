"use client";

import { useMemo } from "react";
import { formatDate, relativeDayLabel, type PlainDate } from "@/lib/dates";
import { formatMoney, formatNumber, type CurrencyCode } from "@/lib/money";
import { useReadyData } from "./data-provider";

/** Locale-aware formatters bound to the user's preferences. */
export function useFormat() {
  const { preferences, today } = useReadyData();
  const locale = preferences.locale;
  return useMemo(
    () => ({
      locale,
      money: (minor: number, currency: CurrencyCode, hideDecimals = false) =>
        formatMoney(minor, currency, locale, { hideDecimals }),
      number: (minor: number, currency: CurrencyCode, hideDecimals = false) =>
        formatNumber(minor, currency, locale, hideDecimals),
      day: (date: PlainDate) => relativeDayLabel(date, today, locale),
      date: (date: PlainDate, opts?: Intl.DateTimeFormatOptions) => formatDate(date, locale, opts),
    }),
    [locale, today],
  );
}
