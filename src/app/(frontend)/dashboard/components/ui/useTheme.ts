'use client'
/**
 * The active theme in React (feat/themes). The theme lives on <html
 * data-theme>, set before the first paint by THEME_BOOT; this hook reads it,
 * follows changes, and switches it. Canvas code takes hex values from
 * useThemeTokens(), since a canvas can't read CSS variables.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { DEFAULT_THEME, saveThemeId, themeById, type Theme, type Tokens } from './themes'

const EVENT = 'flame-theme-change'

function current(): string {
  return document.documentElement.getAttribute('data-theme') ?? DEFAULT_THEME
}
function subscribe(on: () => void): () => void {
  window.addEventListener(EVENT, on)
  return () => window.removeEventListener(EVENT, on)
}

/** Put a theme on the page now and save it (Ember: no attribute, the :root default). */
export function applyTheme(id: string): void {
  const th = themeById(id)
  if (th.id === DEFAULT_THEME) document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', th.id)
  saveThemeId(th.id)
  window.dispatchEvent(new Event(EVENT))
}

/** [the active theme id, a setter]. Ember on the server and before hydration. */
export function useThemeId(): [string, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, current, () => DEFAULT_THEME)
  return [id, useCallback((next: string) => applyTheme(next), [])]
}

/** The active theme: its tokens (hex) and whether it is dark. */
export function useActiveTheme(): Theme {
  return themeById(useThemeId()[0])
}

export function useThemeTokens(): Tokens {
  return useActiveTheme().tokens
}
