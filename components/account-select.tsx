"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface AccountOption {
  id: string;
  username: string;
  instagramId: string;
  name?: string | null;
}

interface AccountSelectProps {
  accounts: AccountOption[];
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
  label?: string;
  disabled?: boolean;
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  includeAll = true,
  label = "Instagram account",
  disabled = false,
}: AccountSelectProps) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
        <Select
          value={value}
          disabled={disabled}
        onValueChange={(next) => next != null && onChange(next)}
      >
        <SelectTrigger className="min-w-52" disabled={disabled}>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {includeAll && <SelectItem value="all">All accounts</SelectItem>}
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              @{account.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
