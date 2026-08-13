import { redirect } from "next/navigation";

// Redirect stub: there is no UI to make instant, and redirect() is request-time
// work, so the route is explicitly allowed to block (no static shell exists).
export const instant = false;

export default function AutomationsRedirectPage() {
  redirect("/campaigns");
}
