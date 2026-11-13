/** Payload's "not found" (404) and "forbidden" (403) errors, as opposed to a failure to reach the database. */
export function isNotFoundOrForbidden(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status
  return status === 404 || status === 403
}
