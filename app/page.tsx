import { SiteHeader } from '@/components/site-header'
import { OrderForm } from '@/components/order/order-form'
import { PipelineSteps } from '@/components/pipeline-steps'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-10 md:grid-cols-[1fr_1.4fr] md:py-16">
        <section aria-labelledby="hero-title" className="flex flex-col gap-6">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">Order intake</p>
          <h1 id="hero-title" className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
            Find it. Order it. Tracked forever.
          </h1>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            Scan or type a UPC, ASIN, EAN, or ISBN and we&apos;ll pull the product straight from the retail catalog.
            Every submission is sealed into a tamper-evident ledger before it reaches our workshop.
          </p>
          <PipelineSteps />
        </section>
        <OrderForm />
      </main>
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        {'© '}
        {new Date().getFullYear()} TnkrBruja
      </footer>
    </>
  )
}
