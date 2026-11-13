'use client' // Error boundaries must be Client Components

/**
 * The dashboard's error boundary: any error the page didn't catch itself
 * (page.tsx catches database errors and shows the same message) gets the
 * friendly page instead of a raw error, with "Try again" re-fetching it.
 */
import { useEffect } from 'react'
import { DataUnavailable } from './components/ui/DataUnavailable'

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return <DataUnavailable onRetry={() => retry()} />
}
