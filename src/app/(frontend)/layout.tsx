import React from 'react'
import './global.css'
import { Metadata } from 'next'
import { THEME_BOOT, themeCss } from './dashboard/components/ui/themes'

export const metadata: Metadata = {
  description: '',
  title: 'Freefall Labs - Microgravity',
}

// feat/themes: every theme's colours as CSS variables (Ember on :root), built
// once from ui/themes.ts. Static text from our own table, never user data.
const THEME_CSS = themeCss()

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    // The boot script may set data-theme on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <style id="theme-vars">{THEME_CSS}</style>
        {/* Applies the saved theme before the first paint (no flash of Ember). */}
        <script id="theme-boot" dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
