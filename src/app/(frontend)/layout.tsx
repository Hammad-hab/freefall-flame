import React from 'react'
import './global.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  description: '',
  title: 'Freefall Labs - Microgravity',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
