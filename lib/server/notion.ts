import 'server-only'
import { Client, APIResponseError } from '@notionhq/client'
import type { CreatePageParameters, BlockObjectRequest } from '@notionhq/client'
import { requireEnv } from './env'
import { UpstreamError } from './errors'
import type { OrderRecord } from '@/lib/orders/schema'
import type { LedgerEntry } from './ledger'

type PropertyValues = NonNullable<CreatePageParameters['properties']>
type PropertyValue = PropertyValues[string]
type SchemaProperty = { type: string; status?: { options: { name: string }[] } }

const SCHEMA_TTL_MS = 5 * 60 * 1000
const RICH_TEXT_LIMIT = 2000

let client: Client | null = null
let dataSourceCache: { id: string; properties: Record<string, SchemaProperty>; fetchedAt: number } | null = null

function notion() {
  if (!client) {
    const { NOTION_TOKEN } = requireEnv('NOTION_TOKEN')
    client = new Client({ auth: NOTION_TOKEN, timeoutMs: 20_000 })
  }
  return client
}

const text = (content: string) => [{ type: 'text' as const, text: { content: content.slice(0, RICH_TEXT_LIMIT) } }]

async function resolveDataSource() {
  if (dataSourceCache && Date.now() - dataSourceCache.fetchedAt < SCHEMA_TTL_MS) return dataSourceCache

  const { NOTION_DATA_SOURCE_ID, NOTION_DATABASE_ID } = requireEnv('NOTION_DATA_SOURCE_ID', 'NOTION_DATABASE_ID')
  let id = NOTION_DATA_SOURCE_ID?.trim()

  if (!id) {
    if (!NOTION_DATABASE_ID?.trim()) throw new UpstreamError('Set NOTION_DATABASE_ID or NOTION_DATA_SOURCE_ID', 503)
    const database = await notion().databases.retrieve({ database_id: NOTION_DATABASE_ID.trim() })
    const first = 'data_sources' in database ? database.data_sources[0] : undefined
    if (!first) throw new UpstreamError('The TnkrBruja dev database has no data source', 502)
    id = first.id
  }

  const source = await notion().dataSources.retrieve({ data_source_id: id })
  const properties = ('properties' in source ? source.properties : {}) as Record<string, SchemaProperty>
  dataSourceCache = { id, properties, fetchedAt: Date.now() }
  return dataSourceCache
}

type Primitive = string | number | boolean | null | undefined

function toPropertyValue(prop: SchemaProperty, value: Primitive): PropertyValue | null {
  if (value === undefined || value === null || value === '') return null
  const str = String(value)
  switch (prop.type) {
    case 'title':
      return { title: text(str) }
    case 'rich_text':
      return { rich_text: text(str) }
    case 'number':
      return typeof value === 'number' ? { number: value } : null
    case 'email':
      return { email: str }
    case 'phone_number':
      return { phone_number: str }
    case 'url':
      return str.startsWith('https://') ? { url: str } : null
    case 'select':
      return { select: { name: str.replace(/,/g, ' ').slice(0, 100) } }
    case 'status':
      return prop.status?.options.some((o) => o.name === str) ? { status: { name: str } } : null
    case 'date':
      return { date: { start: str } }
    case 'checkbox':
      return { checkbox: Boolean(value) }
    default:
      return null
  }
}

function buildProperties(schema: Record<string, SchemaProperty>, order: OrderRecord, ledger: LedgerEntry): PropertyValues {
  const byLowerName = new Map(Object.entries(schema).map(([name, prop]) => [name.toLowerCase(), { name, prop }]))
  const titleProp = Object.entries(schema).find(([, p]) => p.type === 'title')?.[0]
  const properties: PropertyValues = {}

  if (titleProp) properties[titleProp] = { title: text(`${order.orderId} · ${order.item.title}`) }

  const fields: Array<[string[], Primitive]> = [
    [['order id', 'order number'], order.orderId],
    [['status', 'stage'], 'Submitted'],
    [['customer', 'customer name', 'client'], order.customer.name],
    [['email', 'customer email'], order.customer.email],
    [['phone', 'customer phone'], order.customer.phone],
    [['item', 'product', 'item title'], order.item.title],
    [['brand'], order.item.brand],
    [['identifier', 'sku', order.item.identifierType], order.item.identifier],
    [['identifier type'], order.item.identifierType.toUpperCase()],
    [['quantity', 'qty'], order.quantity],
    [['price', 'list price', 'unit price'], order.item.listPrice],
    [['fulfillment', 'delivery method'], order.fulfillment],
    [['notes'], order.notes],
    [['submitted', 'submitted at', 'order date', 'date'], order.submittedAt],
    [['ledger id'], ledger.ledgerId],
    [['ledger hash', 'hash'], ledger.hash],
    [['image', 'image url', 'product image'], order.item.imageUrl],
  ]

  for (const [aliases, value] of fields) {
    for (const alias of aliases) {
      const match = byLowerName.get(alias)
      if (!match || match.name === titleProp || properties[match.name]) continue
      const prop = toPropertyValue(match.prop, value)
      if (prop) {
        properties[match.name] = prop
        break
      }
    }
  }
  return properties
}

function buildBody(order: OrderRecord, ledger: LedgerEntry): BlockObjectRequest[] {
  const lines = [
    `Customer: ${order.customer.name} <${order.customer.email}>${order.customer.phone ? ` · ${order.customer.phone}` : ''}`,
    `Item: ${order.item.title}${order.item.brand ? ` (${order.item.brand})` : ''}`,
    `${order.item.identifierType.toUpperCase()}: ${order.item.identifier}`,
    `Quantity: ${order.quantity}`,
    `Fulfillment: ${order.fulfillment}`,
    ...(order.item.listPrice !== undefined ? [`Catalog price: ${order.item.listPrice.toFixed(2)} ${order.item.currency ?? 'USD'}`] : []),
    `Submitted: ${order.submittedAt}`,
  ]

  return [
    { type: 'heading_2', heading_2: { rich_text: text('Order details') } },
    ...lines.map((line) => ({ type: 'bulleted_list_item' as const, bulleted_list_item: { rich_text: text(line) } })),
    ...(order.notes ? [{ type: 'quote' as const, quote: { rich_text: text(order.notes) } }] : []),
    ...(order.item.imageUrl
      ? [{ type: 'image' as const, image: { type: 'external' as const, external: { url: order.item.imageUrl } } }]
      : []),
    { type: 'divider', divider: {} },
    { type: 'heading_2', heading_2: { rich_text: text('Immutable ledger') } },
    {
      type: 'code',
      code: {
        language: 'plain text',
        rich_text: text(`ledgerId: ${ledger.ledgerId}\nseq: ${ledger.seq}\nhash: ${ledger.hash}\nprevHash: ${ledger.prevHash}`),
      },
    },
  ]
}

async function uploadPng(png: Buffer, filename: string) {
  const upload = await notion().fileUploads.create({ mode: 'single_part', filename, content_type: 'image/png' })
  await notion().fileUploads.send({
    file_upload_id: upload.id,
    file: { filename, data: new Blob([new Uint8Array(png)], { type: 'image/png' }) },
  })
  return upload.id
}

export async function createOrderPage(order: OrderRecord, ledger: LedgerEntry) {
  try {
    const source = await resolveDataSource()
    const page = await notion().pages.create({
      parent: { data_source_id: source.id },
      properties: buildProperties(source.properties, order, ledger),
      children: buildBody(order, ledger),
    })
    const url = 'url' in page ? page.url : `https://www.notion.so/${page.id.replace(/-/g, '')}`
    return { pageId: page.id, url }
  } catch (error) {
    throw asUpstream(error, 'create the Notion order page')
  }
}

export async function attachQrCode(pageId: string, png: Buffer, orderId: string) {
  try {
    const fileUploadId = await uploadPng(png, `${orderId}-qr.png`)
    await notion().blocks.children.append({
      block_id: pageId,
      children: [
        { type: 'heading_2', heading_2: { rich_text: text('Order QR code') } },
        {
          type: 'image',
          image: { type: 'file_upload', file_upload: { id: fileUploadId }, caption: text(`Scan to open ${orderId}`) },
        },
      ],
    })
  } catch (error) {
    throw asUpstream(error, 'attach the QR code in Notion')
  }
}

function asUpstream(error: unknown, action: string) {
  if (error instanceof UpstreamError) return error
  if (error instanceof APIResponseError) {
    const hint =
      error.code === 'object_not_found'
        ? ' Share the TnkrBruja dev database with your Notion integration.'
        : error.code === 'unauthorized'
          ? ' Check NOTION_TOKEN.'
          : ''
    return new UpstreamError(`Could not ${action}: ${error.message}.${hint}`, 502)
  }
  return new UpstreamError(`Could not ${action}.`, 502)
}
