import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { orderInputSchema, type ApiError, type OrderResult } from '@/lib/orders/schema'
import { submitOrder } from '@/lib/server/orders'
import { errorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BODY_BYTES = 16 * 1024

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('idempotency-key') ?? ''
  if (!z.uuid().safeParse(idempotencyKey).success) {
    return NextResponse.json<ApiError>({ error: 'A valid Idempotency-Key header is required.' }, { status: 400 })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json<ApiError>({ error: 'Request body is too large.' }, { status: 413 })
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return NextResponse.json<ApiError>({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const parsed = orderInputSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json<ApiError>(
      { error: 'Please check the highlighted fields.', details: z.flattenError(parsed.error).fieldErrors },
      { status: 422 },
    )
  }

  try {
    const result = await submitOrder(parsed.data, idempotencyKey)
    return NextResponse.json<OrderResult>(result, { status: result.duplicate ? 200 : 201 })
  } catch (error) {
    return errorResponse(error, 'orders')
  }
}
