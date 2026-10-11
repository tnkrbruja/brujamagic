import { NextResponse, type NextRequest } from 'next/server'
import { catalogQuerySchema, type ApiError, type CatalogItem } from '@/lib/orders/schema'
import { searchCatalog } from '@/lib/server/synccentric'
import { errorResponse } from '@/lib/server/errors'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const parsed = catalogQuerySchema.safeParse({
    identifier: request.nextUrl.searchParams.get('identifier'),
    type: request.nextUrl.searchParams.get('type'),
  })
  if (!parsed.success) {
    return NextResponse.json<ApiError>({ error: 'Enter an identifier and choose its type.' }, { status: 400 })
  }

  try {
    const items = await searchCatalog(parsed.data.identifier, parsed.data.type)
    return NextResponse.json<{ items: CatalogItem[] }>(
      { items },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (error) {
    return errorResponse(error, 'catalog')
  }
}
