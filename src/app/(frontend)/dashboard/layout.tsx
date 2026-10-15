import type { ReactNode } from "react";

/**
 * Dashboard layout — wraps every dashboard route.
 *
 * Provides the shared dark background and max-width container so individual
 * pages and tabs don't each have to set it up. The layout is intentionally
 * thin: all data fetching and tab state live in page.tsx.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0e0e12] text-white antialiased">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
