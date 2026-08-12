"use client";

/**
 * Logs Account Filter — interactive island
 *
 * The logs table is server-rendered and driven entirely by URL search params,
 * so the account `<select>` is the only client island: on change it rewrites
 * the URL (keeping the current status filter, resetting to page 1) which makes
 * Next.js re-render the Server Component against the database — no client
 * fetch, no JSON round-trip.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";

interface LogsAccountFilterProps {
  accounts: AccountOption[];
  value: string;
}

export default function LogsAccountFilter({
  accounts,
  value,
}: LogsAccountFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (accountId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (accountId === "all") {
        params.delete("instagramAccountId");
      } else {
        params.set("instagramAccountId", accountId);
      }
      // Rebuilding the URL from current params means the active status filter
      // is preserved; pagination resets to the first page.
      params.delete("page");
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [pathname, router, searchParams]
  );

  return <AccountSelect accounts={accounts} value={value} onChange={handleChange} />;
}