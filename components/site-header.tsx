import Link from 'next/link'
import { Sparkles } from 'lucide-react'

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          TnkrBruja
        </Link>
        <a href="#order" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Start an order
        </a>
      </div>
    </header>
  )
}
