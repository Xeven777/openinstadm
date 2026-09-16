"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@base-ui/react/combobox";
import { gooeyToast } from "goey-toast";
import { AI_PROVIDERS, AI_PROVIDER_IDS, type AiProvider } from "@/lib/ai/providers";
import { useWorkspaceContext, isOwner } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CUSTOM = { id: "", label: "Custom model ID" };

export function AiProviderSettings({ provider, model, onProviderChange, onModelChange, disabled }: {
  provider: AiProvider;
  model: string;
  onProviderChange: (provider: AiProvider) => void;
  onModelChange: (model: string) => void;
  disabled: boolean;
}) {
  const workspace = useWorkspaceContext();
  const options = [...AI_PROVIDERS[provider].models, CUSTOM];
  const [customMode, setCustomMode] = useState(() => !AI_PROVIDERS[provider].models.some((option) => option.id === model));
  const selected = customMode ? CUSTOM : options.find((option) => option.id === model) ?? CUSTOM;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ai-provider" className="text-xs font-medium">Provider</label>
          <select id="ai-provider" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={provider} disabled={disabled} onChange={(event) => onProviderChange(event.target.value as AiProvider)}>
            {AI_PROVIDER_IDS.map((id) => <option key={id} value={id}>{AI_PROVIDERS[id].label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="ai-model" className="text-xs font-medium">Model</label>
          <Combobox.Root items={options} value={selected} disabled={disabled}
            itemToStringLabel={(item) => item.label} isItemEqualToValue={(a, b) => a.id === b.id}
            onValueChange={(item) => {
              if (item) {
                setCustomMode(item.id === "");
                onModelChange(item.id);
              }
            }}>
            <div className="flex rounded-md border border-input">
              <Combobox.Input id="ai-model" className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm" placeholder="Search models…" />
              <Combobox.Trigger className="px-3" aria-label="Show models">▾</Combobox.Trigger>
            </div>
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4} className="z-50">
                <Combobox.Popup className="max-h-72 w-[var(--anchor-width)] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  <Combobox.Empty className="p-2 text-sm">No matching models. Clear the search to choose Custom model ID.</Combobox.Empty>
                  <Combobox.List>
                    {(item: typeof CUSTOM) => (
                      <Combobox.Item key={item.id} value={item} className="cursor-pointer rounded px-3 py-2 text-sm data-highlighted:bg-accent">
                        {item.label}
                        {item.id && <span className="block text-xs text-muted-foreground">{item.id}</span>}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          {selected === CUSTOM && <Input aria-label="Custom model ID" value={model} maxLength={200}
            disabled={disabled} placeholder="Enter the exact provider model ID" onChange={(event) => onModelChange(event.target.value)} />}
          <p className="text-[10px] text-muted-foreground">Model ID: {model || "Enter a custom model ID"}</p>
        </div>
      </div>
      <ProviderConnection key={`${workspace?.workspaceId}:${provider}`} provider={provider} />
    </div>
  );
}

function ProviderConnection({ provider }: { provider: AiProvider }) {
  const workspace = useWorkspaceContext();
  const owner = isOwner(workspace);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const connections = useQuery({
    queryKey: ["ai-provider-connections", workspace?.workspaceId],
    enabled: Boolean(workspace?.workspaceId),
    queryFn: async () => {
      const response = await fetch("/api/ai-provider-credentials", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error("Unable to load AI connections");
      return payload.data as { provider: AiProvider; updatedAt: string }[];
    },
  });
  const connected = connections.data?.some((connection) => connection.provider === provider);

  async function saveConnection(remove: boolean) {
    setBusy(true);
    // Keep secrets only in transient input state, and clear immediately on submission.
    const keyToSave = apiKey;
    setApiKey("");
    try {
      const response = await fetch("/api/ai-provider-credentials", {
        method: remove ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...(!remove ? { apiKey: keyToSave } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Connection update failed");
      await connections.refetch();
      gooeyToast.success(remove ? "Provider disconnected" : "Provider key saved");
    } catch (error) {
      gooeyToast.error(error instanceof Error ? error.message : "Connection update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      <p className="text-xs" role="status">
        {connections.isPending ? "Checking connection…" : connections.isError ? "Unable to load connection status." : connected
          ? `${AI_PROVIDERS[provider].label} key saved for this workspace.`
          : "No API key saved for this provider. Replies will use the fallback."}
      </p>
      {owner ? <>
        <label htmlFor="provider-api-key" className="text-xs font-medium">{connected ? "Replace API key" : "API key"}</label>
        <div className="flex flex-wrap gap-2">
          <Input id="provider-api-key" type="password" autoComplete="new-password" value={apiKey}
            className="min-w-48 flex-1" disabled={busy} maxLength={4096} placeholder="Paste a new API key"
            onChange={(event) => setApiKey(event.target.value)} />
          <Button type="button" disabled={busy || !apiKey.trim()} onClick={() => void saveConnection(false)}>
            {busy ? "Updating…" : connected ? "Replace key" : "Save key"}
          </Button>
          {connected && <Button type="button" variant="outline" disabled={busy} onClick={() => void saveConnection(true)}>Remove key</Button>}
        </div>
        <p className="text-[10px] text-muted-foreground">Encrypted and write-only. Shared by this workspace’s automations using {AI_PROVIDERS[provider].label}. Removing it makes them use their fallback replies.</p>
      </> : <p className="text-xs text-muted-foreground">Only the workspace owner can add, replace, or remove provider keys.</p>}
    </div>
  );
}
