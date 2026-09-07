"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckIcon,
  CopyIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react/dist/ssr";
import { CAMPAIGN_TEMPLATES } from "@/lib/templates/campaign-templates";
import { cn } from "@/lib/utils";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(key);
    window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
  }

  return { copied, copy };
}

export default function ExamplesNichePicker() {
  const [slug, setSlug] = useState(CAMPAIGN_TEMPLATES[0]?.slug ?? "");
  const { copied, copy } = useCopy();
  const active =
    CAMPAIGN_TEMPLATES.find((t) => t.slug === slug) ?? CAMPAIGN_TEMPLATES[0];

  if (!active) return null;

  const keywordsText = active.keywords.join(", ");
  const dmText = active.dmMessage.replace("{username}", "there");

  return (
    <div>
      {/* Niche tabs */}
      <div className="flex flex-wrap gap-2">
        {CAMPAIGN_TEMPLATES.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => setSlug(t.slug)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-all",
              t.slug === active.slug
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {t.title}
          </button>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[1fr_1fr]">
            {/* Left: setup */}
            <div className="space-y-6 p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{active.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ~{active.setupMinutes} min to set up · for{" "}
                    {active.audience}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight">
                  {active.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {active.summary}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    1 · Keywords to paste
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void copy(`${active.slug}-kw`, keywordsText)}
                  >
                    {copied === `${active.slug}-kw` ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {active.keywords.map((kw) => (
                    <code
                      key={kw}
                      className="rounded-md border border-border bg-muted px-2.5 py-1 font-mono text-sm font-bold"
                    >
                      {kw}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    2 · DM reply to paste
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => void copy(`${active.slug}-dm`, dmText)}
                  >
                    {copied === `${active.slug}-dm` ? (
                      <>
                        <CheckIcon className="size-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 rounded-xl border border-dashed border-border bg-muted/40 p-4">
                  <p className="text-sm leading-6">{dmText}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try commenting “{active.triggerExample}” — this is the DM
                    that arrives, with your tracked link attached.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: playbook */}
            <div className="border-t border-border bg-muted/30 p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase tracking-widest text-primary">
                3 · Launch playbook
              </p>
              <ol className="mt-4 space-y-3">
                {active.playbook.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-6">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground/80">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Best for
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {active.bestFor.map((b) => (
                    <Badge key={b} variant="outline">
                      {b}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Watch in analytics
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {active.metrics.join(" · ")}
                </p>
              </div>
              <p className="mt-6 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                Expected outcome: {active.outcome}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <a
        href="/login"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        Paste this into a new campaign
        <ArrowRightIcon className="size-4" />
      </a>
    </div>
  );
}
