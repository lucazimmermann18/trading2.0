import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TradeAI Pro — Institutional Signal Engine",
  description: "Professional forex & crypto trading signal scanner powered by AI",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden">{children}</body>
    </html>
  )
}
