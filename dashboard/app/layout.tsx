import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'KabuScraper Dashboard',
  description: 'Stock scraper configuration and results',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
