import type { ReactNode } from "react";
import ThreeBackground from "./components/overview/ThreeBackground";

/**
 * Dashboard layout — wraps every dashboard route.
 *
 * Provides the shared dark background and max-width container so individual
 * pages and tabs don't each have to set it up. The layout is intentionally
 * thin: all data fetching and tab state live in page.tsx.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="min-h-screen bg-[#100e0c] text-white antialiased">
          {children}
      </div>
    </div>
  );
}
