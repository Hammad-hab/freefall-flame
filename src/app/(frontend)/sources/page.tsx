import Link from 'next/link'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import '@/app/(frontend)/global.css'
import { Metadata } from 'next'

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument' })

export const metadata: Metadata = {
  title: 'Flame in Freefall - Sources',
  description:
    "See the sources used for the analysis",
}


export default function HomePage() {
  return (
    <div className={`${display.variable} ${body.variable} min-h-screen font-body leading-relaxed`}>
        Pending.
    </div>
  )
}