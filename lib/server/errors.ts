import 'server-only'
import { NextResponse } from 'next/server'
import { ConfigError } from './env'
import type { ApiError } from '@/lib/orders/schema'

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'UpstreamError'
  }
}

export function errorResponse(error: unknown, context: string) {
  if (error instanceof ConfigError) {
    console.error(`[${context}]`, error.message)
    return NextResponse.json<ApiError>(
      { error: 'Service is not configured yet.', details: { missing: error.missing } },
      { status: 503 },
    )
  }
  if (error instanceof UpstreamError) {
    console.error(`[${context}]`, error.message)
    return NextResponse.json<ApiError>({ error: error.message }, { status: error.status })
  }
  console.error(`[${context}] unexpected error`, error)
  return NextResponse.json<ApiError>({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}
