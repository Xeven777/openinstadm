"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  lang,
  title,
  className,
}: {
  code: string;
  lang?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950",
        className,
      )}
    >
      {(title || lang) && (
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
          <span className="flex items-center gap-2">
            {title && (
              <span className="text-xs font-medium tracking-wide text-zinc-300">
                {title}
              </span>
            )}
            {lang && (
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                {lang}
              </span>
            )}
          </span>
          <button
            onClick={onCopy}
            aria-label={copied ? "Copied" : "Copy code"}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/[0.1] hover:text-white"
          >
            {copied ? (
              <>
                <Check weight="bold" className="size-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy weight="bold" className="size-3.5" /> Copy
              </>
            )}
          </button>
        </div>
      )}
      {!title && !lang && (
        <button
          onClick={onCopy}
          aria-label={copied ? "Copied" : "Copy code"}
          className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 opacity-0 transition hover:bg-zinc-700 hover:text-white group-hover:opacity-100 focus:opacity-100"
        >
          {copied ? (
            <>
              <Check weight="bold" className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy weight="bold" className="size-3.5" /> Copy
            </>
          )}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-6">
        <code className="font-mono text-zinc-100">{code.trim()}</code>
      </pre>
    </div>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[13px] font-medium text-foreground ring-1 ring-border">
      {children}
    </code>
  );
}
