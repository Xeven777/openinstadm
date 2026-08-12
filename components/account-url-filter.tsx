"use client";

/**
 * Account URL Filter — interactive island
 *
 * For server-rendered pages driven entirely by URL search params (logs,
 * dashboard, ...): the account `<select>` is the only client island. On change
 * it rewrites the URL (preserving other params like the status filter, resetting
 * pagination) which makes Next.js re-render the Server Component against the
 * database — no client fetch, no JSON round-trip.
 */

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AccountSelect, { type AccountOption } from "@/components/account-select";

interface AccountUrlFilterProps {
  accounts: AccountOption[];
  value: string;
}

export default function AccountUrlFilter({
  accounts,
  value,
}: AccountUrlFilterProps) {
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
