import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrderResult } from '@/lib/orders/schema'

export function OrderConfirmation({ result, onNewOrder }: { result: OrderResult; onNewOrder: () => void }) {
  return (
    <Card id="order" role="status">
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          <ShieldCheck aria-hidden="true" />
          Sealed in ledger #{result.ledger.seq}
        </Badge>
        <CardTitle className="text-2xl">Order {result.orderId} received</CardTitle>
        <CardDescription>
          {result.duplicate
            ? 'This order was already submitted, so here is the original record.'
            : 'Your order is logged and our workshop has it.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URL */}
        <img
          src={result.qrDataUrl}
          alt={`QR code linking to order ${result.orderId}`}
          className="size-44 rounded-md border border-border bg-card p-2"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{new Date(result.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ledger hash</dt>
              <dd className="break-all font-mono text-xs">{result.ledger.hash}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={result.notion.url} target="_blank" rel="noopener noreferrer">
                Open in Notion
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
            <Button onClick={onNewOrder}>Place another order</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
