'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { ScanBarcode, Search } from 'lucide-react'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'
import { detectIdentifierType } from '@/lib/orders/barcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchJson } from '@/lib/fetcher'
import { IDENTIFIER_TYPES, type CatalogItem, type IdentifierType } from '@/lib/orders/schema'
import { CatalogItemCard } from './catalog-item-card'

const TYPE_LABELS: Record<IdentifierType, string> = {
  upc: 'UPC',
  asin: 'ASIN',
  ean: 'EAN',
  isbn: 'ISBN',
  keyword: 'Keyword',
}

type Props = {
  selected: CatalogItem | null
  onSelect: (item: CatalogItem | null) => void
}

export function CatalogLookup({ selected, onSelect }: Props) {
  const [identifier, setIdentifier] = useState('')
  const [type, setType] = useState<IdentifierType>('upc')
  const [query, setQuery] = useState<{ identifier: string; type: IdentifierType } | null>(null)

  const key = query ? `/api/catalog?${new URLSearchParams(query).toString()}` : null
  const { data, error, isLoading } = useSWR(key, (url: string) => fetchJson<{ items: CatalogItem[] }>(url), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function runLookup(value = identifier, lookupType = type) {
    const trimmed = value.trim()
    if (trimmed.length < 2) return
    onSelect(null)
    setQuery({ identifier: trimmed, type: lookupType })
  }

  useBarcodeScanner({
    scanTarget: inputRef,
    onScan: (code) => {
      const detected = detectIdentifierType(code) ?? (type === 'keyword' ? 'upc' : type)
      setIdentifier(code)
      setType(detected)
      runLookup(code, detected)
      inputRef.current?.focus()
    },
  })

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-lg font-semibold">1. Find the item</legend>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2 sm:w-32">
          <Label htmlFor="identifier-type">Lookup by</Label>
          <Select value={type} onValueChange={(v) => setType(v as IdentifierType)}>
            <SelectTrigger id="identifier-type" className="w-full">
              <SelectValue>{TYPE_LABELS[type]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {IDENTIFIER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="identifier">{TYPE_LABELS[type]}</Label>
          <Input
            ref={inputRef}
            id="identifier"
            aria-describedby="identifier-hint"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              runLookup()
            }}
            placeholder={type === 'keyword' ? 'e.g. cast iron skillet' : 'e.g. 012345678905'}
            autoComplete="off"
            maxLength={120}
          />
        </div>
        <Button type="button" onClick={() => runLookup()} disabled={isLoading || identifier.trim().length < 2}>
          {isLoading ? <Spinner /> : <Search aria-hidden="true" />}
          Look up
        </Button>
      </div>
      <p id="identifier-hint" className="flex items-center gap-2 text-sm text-muted-foreground">
        <ScanBarcode aria-hidden="true" className="size-4" />
        Scanner ready: scan a barcode anytime and the lookup runs automatically.
      </p>

      <div aria-live="polite" className="flex flex-col gap-3">
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        {data && data.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No catalog match. Check the number and try again.</p>
        )}
        {data && data.items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {data.items.map((item) => (
              <li key={item.sourceId}>
                <CatalogItemCard
                  item={item}
                  selected={selected?.sourceId === item.sourceId}
                  onSelect={() => onSelect(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  )
}
