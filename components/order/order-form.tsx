'use client'

import { useState } from 'react'
import useSWRMutation from 'swr/mutation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiRequestError, fetchJson } from '@/lib/fetcher'
import { FULFILLMENT_OPTIONS, type CatalogItem, type OrderInput, type OrderResult } from '@/lib/orders/schema'
import { CatalogLookup } from './catalog-lookup'
import { OrderConfirmation } from './order-confirmation'

const FULFILLMENT_LABELS: Record<(typeof FULFILLMENT_OPTIONS)[number], string> = {
  pickup: 'Pickup',
  delivery: 'Local delivery',
  ship: 'Ship to me',
}

type FieldErrors = Partial<Record<string, string[]>>

async function postOrder(url: string, { arg }: { arg: { input: OrderInput; key: string } }) {
  return fetchJson<OrderResult>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': arg.key },
    body: JSON.stringify(arg.input),
  })
}

export function OrderForm() {
  const [item, setItem] = useState<CatalogItem | null>(null)
  const [fulfillment, setFulfillment] = useState<OrderInput['fulfillment']>('pickup')
  // Kept stable across retries of the same order so the server can dedupe; reset after success.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const { trigger, data, error, isMutating, reset } = useSWRMutation('/api/orders', postOrder)

  const fieldErrors: FieldErrors =
    error instanceof ApiRequestError && error.status === 422 ? ((error.details as FieldErrors) ?? {}) : {}

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!item) return
    const form = new FormData(e.currentTarget)
    const input: OrderInput = {
      item,
      quantity: Number(form.get('quantity')),
      customer: {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
      },
      fulfillment,
      notes: String(form.get('notes') ?? ''),
    }
    try {
      await trigger({ input, key: idempotencyKey })
    } catch {
      // Surfaced through `error`.
    }
  }

  function startOver() {
    reset()
    setItem(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  if (data) return <OrderConfirmation result={data} onNewOrder={startOver} />

  return (
    <Card id="order" className="scroll-mt-6">
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate={false}>
          <CatalogLookup selected={item} onSelect={setItem} />

          <fieldset className="flex flex-col gap-4" disabled={!item}>
            <legend className="mb-2 text-lg font-semibold">2. Your details</legend>
            {!item && <p className="text-sm text-muted-foreground">Select an item above to continue.</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="name" label="Full name" error={fieldErrors.customer?.[0]}>
                <Input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
              </Field>
              <Field id="email" label="Email">
                <Input id="email" name="email" type="email" required maxLength={254} autoComplete="email" />
              </Field>
              <Field id="phone" label="Phone (optional)">
                <Input id="phone" name="phone" type="tel" maxLength={32} autoComplete="tel" />
              </Field>
              <Field id="quantity" label="Quantity" error={fieldErrors.quantity?.[0]}>
                <Input id="quantity" name="quantity" type="number" required min={1} max={99} step={1} defaultValue={1} />
              </Field>
            </div>

            <Field id="fulfillment" label="Fulfillment">
              <Select value={fulfillment} onValueChange={(v) => setFulfillment(v as OrderInput['fulfillment'])}>
                <SelectTrigger id="fulfillment" className="w-full">
                  <SelectValue>{FULFILLMENT_LABELS[fulfillment]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FULFILLMENT_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>
                      {FULFILLMENT_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="notes" label="Notes (optional)" error={fieldErrors.notes?.[0]}>
              <Textarea id="notes" name="notes" maxLength={1000} rows={3} placeholder="Customizations, deadlines..." />
            </Field>
          </fieldset>

          <div className="flex flex-col gap-3" aria-live="polite">
            {error && <p className="text-sm text-destructive">{error.message}</p>}
            <Button type="submit" size="lg" disabled={!item || isMutating}>
              {isMutating && <Spinner />}
              {isMutating ? 'Sealing your order...' : 'Submit order'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
