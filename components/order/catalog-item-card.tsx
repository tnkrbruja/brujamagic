import { Check, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CatalogItem } from '@/lib/orders/schema'

type Props = { item: CatalogItem; selected: boolean; onSelect: () => void }

export function CatalogItemCard({ item, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {item.imageUrl ? (
          // Catalog images come from arbitrary retailer CDNs, so next/image remote patterns can't be enumerated.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="size-full object-contain" loading="lazy" />
        ) : (
          <Package className="size-6 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          {[item.brand, `${item.identifierType.toUpperCase()} ${item.identifier}`].filter(Boolean).join(' · ')}
        </p>
        {item.listPrice !== undefined && (
          <p className="text-sm font-medium">
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency ?? 'USD' }).format(
              item.listPrice,
            )}
          </p>
        )}
      </div>
      {selected && (
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-4" aria-hidden="true" />
          <span className="sr-only">Selected</span>
        </span>
      )}
    </button>
  )
}
