/**
 * Instant loading state for the whole dashboard route group.
 *
 * Wraps every page in the group in a Suspense boundary, so client-side
 * navigation between dashboard pages paints this skeleton immediately instead
 * of waiting for each page's data fetch.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-8 w-48 rounded bg-muted/70" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-muted rounded p-5 h-32" />
        ))}
      </div>
      <div className="bg-muted rounded p-6 h-64" />
    </div>
  );
}
