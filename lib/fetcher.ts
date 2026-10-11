import type { ApiError } from '@/lib/orders/schema'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const body = (await res.json().catch(() => ({}))) as T | ApiError
  if (!res.ok) {
    const err = body as ApiError
    throw new ApiRequestError(err.error ?? `Request failed (${res.status})`, res.status, err.details)
  }
  return body as T
}
