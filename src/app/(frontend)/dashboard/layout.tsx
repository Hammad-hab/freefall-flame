import type { ReactNode } from "react";

/**
 * Dashboard layout — wraps every dashboard route.
 *
 * Provides the shared dark background so individual pages don't each have to
 * set it up. The layout is intentionally thin: all data fetching and tab
 * state live in page.tsx / the Workspace client component.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="min-h-screen bg-ink text-fg antialiased">
          {children}
      </div>
    </div>
  );
}
