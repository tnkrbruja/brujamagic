import { z } from 'zod'

export const IDENTIFIER_TYPES = ['upc', 'asin', 'ean', 'isbn', 'keyword'] as const
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number]

export const FULFILLMENT_OPTIONS = ['pickup', 'delivery', 'ship'] as const

export const catalogQuerySchema = z.object({
  identifier: z.string().trim().min(2).max(120),
  type: z.enum(IDENTIFIER_TYPES),
})

export const catalogItemSchema = z.object({
  sourceId: z.string().max(120),
  identifier: z.string().max(120),
  identifierType: z.enum(IDENTIFIER_TYPES),
  title: z.string().min(1).max(500),
  brand: z.string().max(200).optional(),
  imageUrl: z.url().max(2000).optional(),
  listPrice: z.number().nonnegative().max(1_000_000).optional(),
  currency: z.string().length(3).optional(),
})
export type CatalogItem = z.infer<typeof catalogItemSchema>

export const orderInputSchema = z.object({
  item: catalogItemSchema,
  quantity: z.number().int().min(1).max(99),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(254),
    phone: z
      .string()
      .trim()
      .max(32)
      .regex(/^[+\d\s().-]*$/, 'Use digits, spaces, and + ( ) - only')
      .optional()
      .or(z.literal('')),
  }),
  fulfillment: z.enum(FULFILLMENT_OPTIONS),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})
export type OrderInput = z.infer<typeof orderInputSchema>

export type OrderRecord = OrderInput & {
  orderId: string
  submittedAt: string
}

export type OrderResult = {
  orderId: string
  submittedAt: string
  duplicate: boolean
  ledger: { ledgerId: string; seq: number; hash: string; prevHash: string }
  notion: { pageId: string; url: string }
  qrDataUrl: string
}

export type ApiError = { error: string; details?: unknown }
