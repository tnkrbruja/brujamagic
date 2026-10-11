import 'server-only'
import { z } from 'zod'

const serverEnvSchema = z.object({
  SYNCCENTRIC_API_TOKEN: z.string().min(1),
  SYNCCENTRIC_LOCALE: z.string().min(2).default('US'),
  GAS_LEDGER_URL: z.url().startsWith('https://script.google.com/'),
  GAS_LEDGER_SECRET: z.string().min(12),
  NOTION_TOKEN: z.string().min(1),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_DATA_SOURCE_ID: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing or invalid environment variables: ${missing.join(', ')}`)
    this.name = 'ConfigError'
  }
}

type Key = keyof ServerEnv

export function requireEnv<K extends Key>(...keys: K[]): Pick<ServerEnv, K> {
  const mask = Object.fromEntries(keys.map((k) => [k, true as const])) as Partial<Record<Key, true>>
  const result = serverEnvSchema.pick(mask).safeParse(process.env)
  if (!result.success) {
    throw new ConfigError([...new Set(result.error.issues.map((i) => String(i.path[0])))])
  }
  return result.data as unknown as Pick<ServerEnv, K>
}

export function integrationStatus() {
  const valid = (...keys: Key[]) => {
    try {
      requireEnv(...keys)
      return true
    } catch {
      return false
    }
  }
  const has = (k: string) => Boolean(process.env[k]?.trim())
  return {
    synccentric: valid('SYNCCENTRIC_API_TOKEN', 'SYNCCENTRIC_LOCALE'),
    ledger: valid('GAS_LEDGER_URL', 'GAS_LEDGER_SECRET'),
    notion: valid('NOTION_TOKEN') && (has('NOTION_DATABASE_ID') || has('NOTION_DATA_SOURCE_ID')),
  }
}
