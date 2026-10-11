import 'server-only'
import { randomBytes } from 'node:crypto'
import { appendLedgerEvent, findLedgerEvent } from './ledger'
import { attachQrCode, createOrderPage } from './notion'
import { createQrPng, pngToDataUrl } from './qr'
import type { OrderInput, OrderRecord, OrderResult } from '@/lib/orders/schema'

function newOrderId(now: Date) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `TB-${date}-${randomBytes(3).toString('hex').toUpperCase()}`
}

/**
 * Ledger first, then Notion. Each step is keyed by the client's idempotency key, so a retried
 * submission reuses the original ledger entry and Notion page instead of duplicating them.
 */
export async function submitOrder(input: OrderInput, idempotencyKey: string): Promise<OrderResult> {
  const now = new Date()
  const draft: OrderRecord = { ...input, orderId: newOrderId(now), submittedAt: now.toISOString() }

  const submitted = await appendLedgerEvent({
    eventType: 'ORDER_SUBMITTED',
    orderId: draft.orderId,
    idempotencyKey,
    payload: draft,
  })

  const order: OrderRecord = submitted.duplicate ? { ...draft, ...(JSON.parse(submitted.entry.payload) as OrderRecord) } : draft
  const ledger = {
    ledgerId: submitted.entry.ledgerId,
    seq: submitted.entry.seq,
    hash: submitted.entry.hash,
    prevHash: submitted.entry.prevHash,
  }

  if (submitted.duplicate) {
    const linked = await findLedgerEvent(idempotencyKey, 'NOTION_LINKED')
    if (linked) {
      const notion = JSON.parse(linked.payload) as { pageId: string; url: string }
      return {
        orderId: order.orderId,
        submittedAt: order.submittedAt,
        duplicate: true,
        ledger,
        notion,
        qrDataUrl: pngToDataUrl(await createQrPng(notion.url)),
      }
    }
  }

  const notion = await createOrderPage(order, submitted.entry)
  const qrPng = await createQrPng(notion.url)
  await attachQrCode(notion.pageId, qrPng, order.orderId)

  await appendLedgerEvent({
    eventType: 'NOTION_LINKED',
    orderId: order.orderId,
    idempotencyKey,
    payload: notion,
  })

  return {
    orderId: order.orderId,
    submittedAt: order.submittedAt,
    duplicate: submitted.duplicate,
    ledger,
    notion,
    qrDataUrl: pngToDataUrl(qrPng),
  }
}
