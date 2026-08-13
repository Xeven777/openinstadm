# UI Migration Task: Shadcn/UI + Phosphor Icons

## Overview

Migrate OpenInstaDM's hand-rolled UI components to **shadcn/ui** for modularity,
consistency, and dark mode support. Replace all inline SVGs with **Phosphor Icons**
(`@phosphor-icons/react`).

## Decisions

| Decision | Choice |
|---|---|
| Component library | shadcn/ui |
| Icon library | `@phosphor-icons/react` (not Lucide) |
| Dark mode | **Enable** — add `next-themes` + `.dark` class toggling |
| Campaign preview phone mockup | **Keep as-is** (custom Instagram SVGs stay) |
| Landing page theme | **Unify** with dashboard under shadcn CSS variables |

---

## Phase 0: Foundation Setup

### 0.1 — Initialize shadcn/ui

```bash
npx shadcn@latest init
```

**Installs:**
- `@radix-ui/react-*` primitives
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- Creates `components.json` and `lib/utils.ts` with `cn()` helper

**Does NOT install Lucide** — we use Phosphor instead.

### 0.2 — Install Phosphor Icons

```bash
npm i @phosphor-icons/react
```

### 0.3 — Install dark mode support

```bash
npm i next-themes
```

### 0.4 — Rewrite `app/globals.css`

Convert existing design tokens to shadcn CSS variable format:

```css
/* Light theme */
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 4%;
  --card: 0 0% 97%;
  --card-foreground: 240 10% 4%;
  --primary: 25 95% 53%;          /* orange accent */
  --primary-foreground: 0 0% 100%;
  --muted: 240 5% 65%;
  --muted-foreground: 240 5% 45%;
  --border: 240 6% 90%;
  --ring: 25 95% 53%;
  --destructive: 0 84% 60%;
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
  --accent: 25 95% 53%;
  --radius: 0.5rem;
}

/* Dark theme */
.dark {
  --background: 240 10% 4%;
  --foreground: 0 0% 98%;
  --card: 240 6% 10%;
  --card-foreground: 0 0% 98%;
  --primary: 25 95% 53%;
  --primary-foreground: 0 0% 100%;
  --muted: 240 5% 40%;
  --muted-foreground: 240 5% 65%;
  --border: 240 6% 18%;
  --ring: 25 95% 53%;
  --destructive: 0 62% 50%;
  --success: 142 71% 45%;
  --warning: 38 92% 50%;
}
```

Keep `.panel` as a temporary compatibility alias. Remove `.glass`, `.glass-strong`.

### 0.5 — Add ThemeProvider to root layout

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## Phase 1: Install shadcn Components

```bash
npx shadcn@latest add button card input textarea select badge switch tabs skeleton alert dropdown-menu avatar separator label
```

| shadcn Component | Replaces |
|---|---|
| `Button` | All hand-rolled `<button>` elements |
| `Card` (Card, CardHeader, CardTitle, CardContent) | `.panel` class divs |
| `Input` | All `<input>` fields |
| `Textarea` | All `<textarea>` fields |
| `Select` (Select, SelectTrigger, SelectContent, SelectItem) | Native `<select>` elements |
| `Badge` | Status labels, tag pills, active/paused indicators |
| `Switch` | Custom `Toggle` components |
| `Tabs` (Tabs, TabsList, TabsTrigger) | Custom tab bars |
| `Skeleton` | Loading states |
| `Alert` | Error/success banners |
| `DropdownMenu` | Kebab menus |
| `Avatar` | Profile picture displays |
| `Separator` | Border dividers |
| `Label` | Form field labels |

---

## Phase 2: Component Migration

**Status: DONE** — all four groups migrated (verified: `npm run typecheck` ✅, `npm run lint` ✅ 0 errors, `npm run build` ✅ 60/60 pages, `npm test` ✅ 134/137 — 3 pre-existing env failures).

Notes on deviations:
- **`Badge` gained `success` / `warning` / `muted` variants** (`components/ui/badge.tsx`) so status labels use the theme tokens instead of ad-hoc color classes.
- **Landing/SEO CTAs** keep their cyan/dark colors — they're now built on `buttonVariants` (shadcn shape/typography/focus) with color overrides, pending the Phase 3 page-level token unification.
- **`text-muted` → `text-muted-foreground` swept app-wide** (88 occurrences, 15 files): the shadcn theme's `--muted` token is a near-white *surface* color, so the old `text-muted` secondary text was nearly invisible on light backgrounds.
- `dashboard-shell.tsx` and `legal-shell.tsx` needed no changes (no hand-rolled elements). `campaign-preview.tsx` kept as-is per the scope exclusions.

### Group A — Atomic Primitives (no deps on other project components)

| # | File | Changes |
|---|---|---|
| 1 | `components/status-badge.tsx` | `<span>` → shadcn `Badge` with variant per status (SENT=success, FAILED=destructive, PENDING=warning, etc.) |
| 2 | `components/stat-card.tsx` | `.panel` div → shadcn `Card` + `CardContent` |
| 3 | `components/refresh-icon.tsx` | Inline SVG → `import { ArrowsClockwise } from "@phosphor-icons/react"` |
| 4 | `components/diagnostics-refresh.tsx` | `<button>` → shadcn `Button` |
| 5 | `components/overview-refresh.tsx` | `<button>` → shadcn `Button` + Phosphor `ArrowsClockwise` |
| 6 | `components/overview-range-select.tsx` | Native `<select>` → shadcn `Select` |
| 7 | `components/account-select.tsx` | Native `<select>` → shadcn `Select` |
| 8 | `components/invitation-accept-card.tsx` | `<button>` → shadcn `Button` |
| 9 | `components/instagram-connect-notice.tsx` | Raw elements → `Button`/`Card` |

### Group B — Complex Primitives

| # | File | Changes |
|---|---|---|
| 10 | `components/keyword-input.tsx` | Raw input+tags → `Input` + `Badge` + `Button` (with Phosphor `X` icon for remove) |
| 11 | `components/follower-chart.tsx` | Wrap in shadcn `Card` |
| 12 | `components/overview-follower-chart.tsx` | Wrap in shadcn `Card` |

### Group C — Layout & Navigation

| # | File | Changes |
|---|---|---|
| 13 | `components/top-bar.tsx` | Hamburger → `Button` (ghost), Connect → `Button`, Phosphor `List` icon |
| 14 | `components/sidebar.tsx` | Nav links → `Button` (ghost) with active state, Phosphor icons per nav item |
| 15 | `components/dashboard-shell.tsx` | Minimal — uses Sidebar + TopBar |
| 16 | `components/seo-page-shell.tsx` | Buttons → `Button` |
| 17 | `components/public-site-header.tsx` | Buttons → `Button`, GitHub icon → Phosphor `GithubLogo` |
| 18 | `components/legal-shell.tsx` | Minimal changes |

### Group D — Heavy Components

| # | File | Changes |
|---|---|---|
| 19 | `components/campaign-builder.tsx` | `<input>` → `Input`, `<textarea>` → `Textarea`, Toggle → `Switch`, buttons → `Button`, error → `Alert`. Keep custom `Radio` (no shadcn radio group). Phosphor icons: `Plus`, `X`, `Warning` |
| 20 | `components/campaigns-list.tsx` | Search → `Input`, status tabs → `Tabs`, toggle → `Switch`, kebab → `DropdownMenu`, cards → `Card`, tags → `Badge`, Phosphor icons: `MagnifyingGlass`, `DotsThreeVertical`, `ArrowSquareOut`, `Copy`, `Trash`, `Plus` |
| 21 | `components/campaign-detail.tsx` | Cards, badges, buttons, switches, Phosphor icons |
| 22 | `components/campaign-preview.tsx` | **KEEP AS-IS** — custom phone mockup + Instagram-specific SVG icons |
| 23 | `components/post-picker.tsx` | Cards, badges, buttons |

---

## Phase 3: Page-Level Migration

**Status: DONE** — all pages migrated (verified: `npm run typecheck` ✅, `npm run lint` ✅ 0 errors — 1 pre-existing warning in `invitation-accept-card.tsx`, `npm run build` ✅ 60/60 pages, `npm test` ✅ 137/137).

| Page | Changes |
|---|---|
| `app/page.tsx` (landing) | Buttons → `Button`/`buttonVariants` (default + outline variants for CTAs), stat boxes → `Card`, features → `Card`, unify all `zinc`/`orange` hardcodes to shadcn theme tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `text-primary`, `bg-primary`, `text-success`, `text-warning`). Note: brand accents (`text-accent`, `bg-accent`, `bg-orange-500`, `text-orange-600`) map to the app's `--primary` token. |
| `app/login/page.tsx` | Input → `Input`, button → `Button`, `.panel` → `Card` (done previously) |
| `app/(dashboard)/loading.tsx` | Raw skeleton divs → shadcn `Skeleton` |
| `app/(dashboard)/settings/page.tsx` | Usage `.panel` section → `Card`; Suspense fallback → `Skeleton`. Sub-components: `settings-accounts` (disconnect `<button>` → `Button variant="destructive"`, `.panel` → `Card`), `settings-team` (native `<select>` → shadcn `Select`, Copy/Revoke `<button>`s → `Button`, `.panel` → `Card`) |
| `app/(dashboard)/automations/new/page.tsx` | Uses campaign-builder, minimal changes (verified: it is a redirect stub, `export const instant = false`, no UI — no change needed) |
| SEO landing pages | Buttons → `Button` (done via `seo-page-shell.tsx` `buttonVariants` CTAs, verified) |

---

## Phase 4: Cleanup

**Status: DONE** (verified: `npm run typecheck` ✅, `npm run lint` ✅ 0 errors — 1 pre-existing warning in `invitation-accept-card.tsx`, `npm run build` ✅ 60/60, `npm test` ✅ 137/137).

1. Removed `.panel`, `.glass`, `.glass-strong`, `.gradient-mesh` from `globals.css`
2. Removed inline SVGs replaced by Phosphor icons — GitHub icon in `app/page.tsx` (header + footer) now uses Phosphor `GithubLogo`. (Scope exclusions kept: `campaign-preview.tsx` phone mockup/Instagram SVGs, decorative chart polyline in the landing preview.)
3. Removed `.animate-fade-in` / `.animate-slide-in` / `.animate-pulse-glow` / `.stagger` no-op classes from `globals.css`
4. Pruned non-standard custom theme tokens from `globals.css` `@theme inline`: removed `--color-surface`, `--color-surface-hover`, `--color-border-hover`, `--color-accent-hover`, `--color-error`. Converted `--color-success` to oklch. Consumers migrated to shadcn standard tokens: `text/bg/border-error` → `text/bg/border-destructive`, `hover:border-border-hover` → `hover:border-foreground/20`, `bg-accent`+`hover:bg-accent-hover` action buttons → `bg-primary`/`hover:bg-primary/80`.
5. Updated `task.md` checkboxes.

---

## Scope Exclusions (keep as-is)

- `campaign-preview.tsx` phone mockup and Instagram-specific SVG icons
- Recharts integration (just wrap in `Card`)
- All business logic / API calls / BullMQ / Prisma — zero changes
- `campaign-builder.tsx` custom `Radio` component (no shadcn equivalent that fits)

---

## Phosphor Icon Mapping

Icons needed across the codebase:

| Usage | Phosphor Icon | Weight |
|---|---|---|
| Refresh/sync | `ArrowsClockwise` | `bold` |
| Hamburger menu | `List` | `bold` |
| Close/remove | `X` | `bold` |
| Add/plus | `Plus` | `bold` |
| External link | `ArrowSquareOut` | `bold` |
| Copy | `Copy` | `bold` |
| Delete | `Trash` | `bold` |
| Search | `MagnifyingGlass` | `bold` |
| More options | `DotsThreeVertical` | `bold` |
| Warning | `Warning` | `fill` |
| Chevron down | `CaretDown` | `bold` |
| Check | `Check` | `bold` |
| GitHub | `GithubLogo` | `fill` |
| Instagram | Keep SVG (brand icon, not in Phosphor) | — |
| Back arrow | `ArrowLeft` | `bold` |

---

## File Count Summary

| Category | Files |
|---|---|
| shadcn components to install | 14 |
| Existing components to modify | ~20 (out of 25) |
| Pages to modify | ~8 |
| Config files | `globals.css`, `package.json` |
| New files | `lib/utils.ts` (from shadcn init), `components.json` |
| **Total files touched** | **~32** |
