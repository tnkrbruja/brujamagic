import { NextResponse } from 'next/server'
import { integrationStatus } from '@/lib/server/env'

export const dynamic = 'force-dynamic'

export function GET() {
  const integrations = integrationStatus()
  const ready = Object.values(integrations).every(Boolean)
  return NextResponse.json({ ready, integrations }, { status: ready ? 200 : 503 })
}
