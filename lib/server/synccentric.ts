import 'server-only'
import { requireEnv } from './env'
import { UpstreamError } from './errors'
import { catalogItemSchema, type CatalogItem, type IdentifierType } from '@/lib/orders/schema'

const SEARCH_URL = 'https://app.synccentric.com/api/v3/products/search'

type RawRecord = Record<string, unknown>

function pick<T>(source: RawRecord, keys: string[], guard: (v: unknown) => v is T): T | undefined {
  for (const key of keys) {
    const value = source[key]
    if (guard(value)) return value
  }
  return undefined
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

function toPrice(source: RawRecord): number | undefined {
  const raw = pick(source, ['lowest_new_price', 'buybox_new_landed_price', 'list_price', 'price', 'amount'], (v): v is string | number =>
    typeof v === 'number' || isNonEmptyString(v),
  )
  if (raw === undefined) return undefined
  const value = typeof raw === 'number' ? raw : Number.parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalize(raw: unknown, identifier: string, identifierType: IdentifierType): CatalogItem | null {
  if (!raw || typeof raw !== 'object') return null
  const envelope = raw as RawRecord
  const attrs = (envelope.attributes && typeof envelope.attributes === 'object' ? envelope.attributes : envelope) as RawRecord

  const title = pick(attrs, ['title', 'item_name', 'name', 'product_title'], isNonEmptyString)
  if (!title) return null

  const image = pick(attrs, ['large_image', 'medium_image', 'image', 'image_url', 'small_image'], isNonEmptyString)

  const candidate = {
    sourceId: String(envelope.id ?? attrs.asin ?? identifier),
    identifier: pick(attrs, [identifierType, 'asin', 'upc', 'ean'], isNonEmptyString) ?? identifier,
    identifierType,
    title: title.slice(0, 500),
    brand: pick(attrs, ['brand', 'manufacturer', 'label'], isNonEmptyString)?.slice(0, 200),
    imageUrl: image?.startsWith('https://') ? image : undefined,
    listPrice: toPrice(attrs),
    currency: pick(attrs, ['currency', 'currency_code'], isNonEmptyString)?.slice(0, 3).toUpperCase(),
  }

  const parsed = catalogItemSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export async function searchCatalog(identifier: string, type: IdentifierType): Promise<CatalogItem[]> {
  const { SYNCCENTRIC_API_TOKEN, SYNCCENTRIC_LOCALE } = requireEnv('SYNCCENTRIC_API_TOKEN', 'SYNCCENTRIC_LOCALE')

  const url = new URL(SEARCH_URL)
  url.searchParams.append('identifier[]', identifier)
  url.searchParams.set('type', type)
  url.searchParams.set('locale', SYNCCENTRIC_LOCALE)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SYNCCENTRIC_API_TOKEN}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 3600 },
  })

  if (res.status === 404) return []
  if (!res.ok) {
    throw new UpstreamError(`Synccentric responded with ${res.status}`, res.status === 429 ? 429 : 502)
  }

  const body = (await res.json()) as unknown
  const records = Array.isArray(body)
    ? body
    : Array.isArray((body as RawRecord)?.data)
      ? ((body as RawRecord).data as unknown[])
      : [(body as RawRecord)?.data ?? body]

  return records
    .map((r) => normalize(r, identifier, type))
    .filter((r): r is CatalogItem => r !== null)
    .slice(0, 10)
}
