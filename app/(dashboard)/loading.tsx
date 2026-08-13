/**
 * Instant loading state for the whole dashboard route group.
 *
 * Wraps every page in the group in a Suspense boundary, so client-side
 * navigation between dashboard pages paints this skeleton immediately instead
 * of waiting for each page's data fetch.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
