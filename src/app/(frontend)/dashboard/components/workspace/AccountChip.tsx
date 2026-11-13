'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '../ui/Card'

/** The signed-in account, as much of it as the sidebar shows. */
export interface SessionUser {
  id: string
  email: string
}

/**
 * A small account control for the sidebar's corner.
 *
 * It asks the server who is signed in: the browser sends Payload's auth
 * cookie, so the answer reflects the login route's session (login, signup
 * and logout). Three states, and only one control:
 *
 *   signed out  → a "Log in" button that goes to the login route
 *   signed in   → a badge with the first letter of the email and the email
 *                 itself, plus a way out
 *   signed out  → after a logout, without a reload
 *
 * The email is the only personal text on screen; the badge is its first
 * letter, never a name we invent. On a narrow window the sidebar is a thin
 * strip, so the label hides and the letter badge carries the state.
 */
export default function AccountChip({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    // A stale answer (a logout in another tab) is worse than a loading one,
    // so the request is aborted when this chip unmounts or the effect reruns.
    const ctrl = new AbortController()
    fetch('/api/users/me', { credentials: 'include', signal: ctrl.signal })
      .then(async (res) => {
        if (!alive) return
        // Payload's /me answers 200 with { user: null } when there is no
        // session, so the signed-out case is a normal answer, not an error.
        const data = await res.json().catch(() => null)
        const email = data?.user?.email
        if (typeof email !== 'string' || email.trim() === '') return setUser(null)
        setUser({ id: String(data.user.id), email })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (alive) setUser(null)
      })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [])

  async function logout() {
    setBusy(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // A logout that never reached the server is still a signed-out chip:
      // the next request will tell the truth again.
    } finally {
      setBusy(false)
      setUser(null)
      window.dispatchEvent(new Event('auth:changed'))
    }
  }

  const initial = user ? user.email.trim().charAt(0).toUpperCase() : ''

  // Collapsed to a sliver: the letter badge is the whole control. It still
  // opens the login route when signed out, and still logs out when signed in.
  if (compact) {
    return (
      <div className="flex justify-center" data-account-chip>
        {user ? (
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            aria-label={`Log out of ${user.email}`}
            title={busy ? 'Logging out…' : `Log out of ${user.email}`}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-flame-amber text-[11px] font-semibold text-on transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {initial || '?'}
          </button>
        ) : (
          <Link
            href="/login"
            data-account-login
            aria-label="Log in"
            title="Log in"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-muted hover:text-fg"
          >
            <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-line px-2 py-2" data-account-chip>
      {user ? (
        <div className="group flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-flame-amber text-[11px] font-semibold text-on"
          >
            {initial || '?'}
          </span>
          {/* The email is the account's whole identity here; it truncates
              rather than wrapping, and the full address stays in the title. */}
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted" title={user.email}>
            {user.email}
          </span>
          <button
            type="button"
            onClick={logout}
            disabled={busy}
            aria-label="Log out"
            title="Log out"
            className="rounded p-1 text-muted transition-colors hover:bg-line hover:text-fg disabled:opacity-60"
          >
            <Icon d="M15 12H3M9 8l-4 4 4 4M15 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          data-account-login
          className="flex items-center gap-2 px-1 py-0.5 text-[12px] text-muted transition-colors hover:text-fg"
        >
          <Icon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" className="h-3.5 w-3.5" />
          Log in
        </Link>
      )}
    </div>
  )
}
