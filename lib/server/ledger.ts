import 'server-only'
import { z } from 'zod'
import { requireEnv } from './env'
import { UpstreamError } from './errors'

export const LEDGER_EVENTS = ['ORDER_SUBMITTED', 'NOTION_LINKED'] as const
export type LedgerEvent = (typeof LEDGER_EVENTS)[number]

const ledgerEntrySchema = z.object({
  seq: z.number().int(),
  ledgerId: z.string(),
  timestamp: z.string(),
  eventType: z.enum(LEDGER_EVENTS),
  orderId: z.string(),
  idempotencyKey: z.string(),
  payload: z.string(),
  prevHash: z.string(),
  hash: z.string(),
})
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>

const responseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), entry: ledgerEntrySchema.nullable(), duplicate: z.boolean().optional() }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

async function call(action: 'append' | 'find', body: Record<string, unknown>) {
  const { GAS_LEDGER_URL, GAS_LEDGER_SECRET } = requireEnv('GAS_LEDGER_URL', 'GAS_LEDGER_SECRET')

  // Apps Script web apps cannot read request headers, so the shared secret travels in the body.
  // fetch follows the 302 to script.googleusercontent.com, which is how Apps Script returns output.
  const res = await fetch(GAS_LEDGER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, secret: GAS_LEDGER_SECRET, ...body }),
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
  })

  if (!res.ok) throw new UpstreamError(`Ledger responded with ${res.status}`, 502)

  const parsed = responseSchema.safeParse(await res.json().catch(() => null))
  if (!parsed.success) throw new UpstreamError('Ledger returned an unexpected response', 502)
  if (!parsed.data.ok) throw new UpstreamError(`Ledger rejected the request: ${parsed.data.error}`, 502)
  return parsed.data
}

export async function appendLedgerEvent(input: {
  eventType: LedgerEvent
  orderId: string
  idempotencyKey: string
  payload: unknown
}): Promise<{ entry: LedgerEntry; duplicate: boolean }> {
  const result = await call('append', { ...input, payload: JSON.stringify(input.payload) })
  if (!result.entry) throw new UpstreamError('Ledger did not return the appended entry', 502)
  return { entry: result.entry, duplicate: Boolean(result.duplicate) }
}

export async function findLedgerEvent(idempotencyKey: string, eventType: LedgerEvent): Promise<LedgerEntry | null> {
  const result = await call('find', { idempotencyKey, eventType })
  return result.entry
}
