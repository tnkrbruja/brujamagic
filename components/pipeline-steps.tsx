import { Database, FileSpreadsheet, QrCode, ScanBarcode } from 'lucide-react'

const STEPS = [
  { icon: ScanBarcode, title: 'Catalog lookup', body: 'Product data pulled live from Synccentric.' },
  { icon: FileSpreadsheet, title: 'Immutable ledger', body: 'Hash-chained entry written to Google Sheets.' },
  { icon: Database, title: 'Workshop record', body: 'A new page in the TnkrBruja dev database.' },
  { icon: QrCode, title: 'QR code', body: 'Generated and attached to the Notion page.' },
]

export function PipelineSteps() {
  return (
    <ol className="flex flex-col gap-4">
      {STEPS.map(({ icon: Icon, title, body }, i) => (
        <li key={title} className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium">
              <span className="sr-only">Step {i + 1}: </span>
              {title}
            </p>
            <p className="text-sm text-muted-foreground">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
