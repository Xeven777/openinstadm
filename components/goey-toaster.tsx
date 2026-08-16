"use client";

import { useTheme } from "next-themes";
import { GooeyToaster } from "goey-toast";

export default function GooeyToasterMount() {
  const { resolvedTheme } = useTheme();

  return (
    <GooeyToaster
      position="bottom-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      richColors
      bounce={0.15}
      visibleToasts={2}
    />
  );
}
