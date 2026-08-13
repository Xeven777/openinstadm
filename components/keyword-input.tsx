"use client";

/**
 * Keyword Input
 *
 * Tag-style input for adding/removing keywords.
 */

import { useState, type KeyboardEvent } from "react";
import { X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface KeywordInputProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  max?: number;
}

export default function KeywordInput({ keywords, onChange, max = 10 }: KeywordInputProps) {
  const [input, setInput] = useState("");

  function addKeyword(value: string) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) return;
    if (keywords.length >= max) return;
    onChange([...keywords, trimmed]);
    setInput("");
  }

  function removeKeyword(keyword: string) {
    onChange(keywords.filter((k) => k !== keyword));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === "Backspace" && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted p-3 min-h-[48px]">
        {keywords.map((keyword) => (
          <Badge key={keyword} variant="outline" className="gap-1 pr-1">
            {keyword}
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              aria-label={`Remove ${keyword}`}
              className="text-muted-foreground transition-colors hover:text-error"
            >
              <X weight="bold" className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            keywords.length === 0 ? "Type keyword and press Enter..." : ""
          }
          className="h-8 min-w-[120px] flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {keywords.length}/{max} keywords · Press Enter or comma to add
      </p>
    </div>
  );
}
