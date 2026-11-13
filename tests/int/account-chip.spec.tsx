/**
 * The sidebar's account chip: it asks the server who is signed in, offers the
 * login route when they are not, and shows the email plus a letter badge when
 * they are. The letter is the email's first character, never a name.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import AccountChip from '@/app/(frontend)/dashboard/components/workspace/AccountChip'
import Sidebar from '@/app/(frontend)/dashboard/components/workspace/Sidebar'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A signed-in answer, as Payload's /api/users/me returns it. */
const me = (email: string, id = 7) => ({ ok: true, json: async () => ({ user: { id, email } }) })
const signedOut = { ok: false, status: 401, json: async () => ({ errors: [{ message: 'Not authenticated' }] }) }

describe('AccountChip', () => {
  it('offers the login route when nobody is signed in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => signedOut))
    render(<AccountChip />)

    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
  })

  it('shows the email and a badge with its first letter when signed in', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('Hammad@Example.com')))
    render(<AccountChip />)

    // The badge letter is the email's first letter, uppercased.
    await screen.findByText('Hammad@Example.com')
    const badge = document.querySelector('[data-account-chip] span')!
    expect(badge.textContent).toBe('H')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeDefined()
  })

  // A blank email is a signed-out answer, not a badge with no letter.
  it('treats a blank email as signed out rather than showing an empty badge', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: { id: 1, email: '   ' } }) })))
    render(<AccountChip />)

    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
  })

  it('uppercases the badge letter when the email starts lowercase', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('h@example.com')))
    render(<AccountChip />)

    await screen.findByText('h@example.com')
    expect(document.querySelector('[data-account-chip] span')?.textContent).toBe('H')
  })

  it('treats a body without an email as signed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ user: null }) })))
    render(<AccountChip />)

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeDefined()
  })

  // Payload's real answer: 200 with { user: null }, not a 401.
  it('reads a 200 with a null user as signed out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ user: null, collection: 'users' }) })),
    )
    render(<AccountChip />)

    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
  })

  it('logs out and shows the login route again, without a reload', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/users/me') return me('a@b.com')
      if (url === '/api/users/logout') return { ok: true, json: async () => ({}) }
      throw new Error(`unexpected ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountChip />)

    await screen.findByText('a@b.com')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    // The chip is signed-out again from its own state; no router refresh.
    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
    expect(fetchMock).toHaveBeenCalledWith('/api/users/logout', expect.objectContaining({ method: 'POST' }))
  })

  it('still shows the login route when the logout request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/users/me') return me('a@b.com')
        if (url === '/api/users/logout') throw new Error('network down')
        throw new Error(`unexpected ${url}`)
      }),
    )
    render(<AccountChip />)

    await screen.findByText('a@b.com')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeDefined()
  })

  it('keeps only the letter badge when collapsed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('zed@example.com')))
    render(<AccountChip compact />)

    const badge = await screen.findByRole('button', { name: 'Log out of zed@example.com' })
    expect(badge.textContent).toBe('Z')
    expect(document.querySelector('[data-account-chip]')?.textContent).toBe('Z')
  })

  it('still offers the login route when collapsed and signed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => signedOut))
    render(<AccountChip compact />)

    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
  })
})

describe('Sidebar', () => {
  it('carries the account chip at its foot, and keeps the Customize button', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => me('a@b.com')))
    render(<Sidebar activeTab="overview" canSplit onOpenTab={() => {}} onSplitRight={() => {}} />)

    await screen.findByText('a@b.com')
    expect(screen.getByRole('button', { name: 'Customize' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeDefined()
  })

  it('shows a compact login badge in the collapsed strip', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => signedOut))
    // A narrow window is what collapses the sidebar; jsdom defaults to 1024px.
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    })))
    render(<Sidebar activeTab="overview" canSplit onOpenTab={() => {}} onSplitRight={() => {}} />)

    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login.getAttribute('href')).toBe('/login')
    expect(document.querySelector('[data-sidebar="collapsed"]')).toBeTruthy()
  })
})
