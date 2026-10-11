# TnkrBruja Orders

Order intake for the TnkrBruja landing page. A customer looks up a retail catalog item (Synccentric), submits an order, and the backend:

1. Validates the order server-side (`zod`)
2. Appends it to an **immutable, hash-chained ledger** in a Google Sheet (Google Apps Script web app)
3. Generates a **QR code** for the order
4. Creates a **new page in the TnkrBruja dev Notion database** with the order details and QR code attached

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and shadcn/ui, and deployed on Vercel.

---

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20.9 or newer (24.x recommended) | Next.js 16 requires at least 20.9 |
| pnpm | 9 or newer | The lockfile is `pnpm-lock.yaml`. Enable with `corepack enable` |
| Git | any recent version | |
| Google account | — | Owns the ledger spreadsheet and Apps Script project |
| Notion workspace | — | Needs an internal integration and the TnkrBruja dev database |
| Synccentric account | — | Needs an API token |
| Vercel account | — | For hosting (optional for local development) |

---

## Dependencies

### Runtime (`dependencies`)

| Package | Purpose |
| --- | --- |
| `next` | Framework (App Router, Route Handlers) |
| `react`, `react-dom` | UI runtime |
| `@notionhq/client` | Notion API: creates order pages and uploads the QR code |
| `qrcode` | Generates the order QR code as a PNG |
| `zod` | Shared validation schema for client and server |
| `swr` | Client data fetching (catalog lookup) and submit mutation |
| `server-only` | Keeps server modules (API keys) out of client bundles |
| `radix-ui` | Accessible primitives behind the shadcn/ui components |
| `class-variance-authority`, `clsx`, `tailwind-merge` | Class name utilities (`cn()` in `lib/utils.ts`) |
| `lucide-react` | Icons |
| `@vercel/analytics` | Vercel Web Analytics |

### Development (`devDependencies`)

| Package | Purpose |
| --- | --- |
| `typescript` (5.x) | Type checking. Pinned to 5.x because Next.js does not yet support TypeScript 7 |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/qrcode` | Type definitions |
| `@types/google-apps-script` | Type hints for `google-apps-script/Code.gs` |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` | Tailwind CSS v4 pipeline |
| `tw-animate-css` | Animation utilities used by shadcn/ui |
| `eslint`, `eslint-config-next` | Linting |
| `@google/clasp` | CLI that pushes and deploys the Apps Script ledger |

---

## Installation

```bash
git clone https://github.com/tnkrbruja/tnkrbruja.dev.git
cd tnkrbruja.dev
corepack enable
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `SYNCCENTRIC_API_TOKEN` | Yes | Synccentric API bearer token |
| `SYNCCENTRIC_LOCALE` | No | Marketplace locale. Defaults to `US` |
| `GAS_LEDGER_URL` | Yes | The Apps Script web app `/exec` URL |
| `GAS_LEDGER_SECRET` | Yes | A shared secret you make up. It must match `LEDGER_SECRET` in the Apps Script's Script Properties |
| `NOTION_TOKEN` | Yes | Notion internal integration secret |
| `NOTION_DATABASE_ID` | Yes | ID of the TnkrBruja dev database |
| `NOTION_DATA_SOURCE_ID` | No | Pins the Notion data source and skips the database lookup |

On Vercel, add these under **Project Settings → Environment Variables**. In v0, add them in the **Vars** panel.

All keys are read server-side only (`lib/server/env.ts`). Never prefix them with `NEXT_PUBLIC_`.

---

## Service setup

### 1. Google Apps Script ledger

1. Create a Google Sheet, then open **Extensions → Apps Script**.
2. Deploy the code in `google-apps-script/` in either of two ways:
   - **Paste it in:** copy `Code.gs` into the editor. Enable "Show appsscript.json" in Project Settings and paste `appsscript.json` too.
   - **Use clasp:** run `pnpm exec clasp login`, put your script ID in `.clasp.json` (`scriptId`), then run `pnpm gas:push`.
3. In **Project Settings → Script Properties**, add `LEDGER_SECRET` with the same value as `GAS_LEDGER_SECRET`.
4. Choose **Deploy → New deployment → Web app** (Execute as: *Me*; Who has access: *Anyone*). Copy the `/exec` URL into `GAS_LEDGER_URL`. With clasp, `pnpm gas:deploy` creates later versions.

The script writes to a sheet named `Ledger` with the columns `seq, ledgerId, timestamp, eventType, orderId, idempotencyKey, payload, prevHash, hash`. Each row stores the hash of the row before it, so any edit to past rows can be detected. Repeated submissions with the same idempotency key return the original entry instead of adding a new row.

### 2. Notion

1. Create an internal integration at <https://www.notion.so/my-integrations> and copy the secret into `NOTION_TOKEN`.
2. Open the TnkrBruja dev database and choose **••• → Connections → add your integration**.
3. Copy the database ID from its URL into `NOTION_DATABASE_ID`.

Properties are matched by name, case-insensitively, against the live database schema. Any that don't exist are skipped, so page creation won't fail. Recognised names:

`Order ID`, `Status`, `Customer`, `Email`, `Phone`, `Item`, `Brand`, `SKU`/`Identifier`, `Identifier Type`, `Quantity`, `Price`, `Fulfillment`, `Notes`, `Submitted`/`Date`, `Ledger ID`, `Ledger Hash`, `Image`

The title property is always set to `<orderId> · <item title>`. The QR code and order summary are added to the page body.

### 3. Synccentric

Copy your API token from the Synccentric dashboard into `SYNCCENTRIC_API_TOKEN`. Catalog lookups go through `/api/catalog`, so the token never reaches the browser.

---

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm gas:push` | Push `google-apps-script/` to Apps Script |
| `pnpm gas:deploy` | Create a new Apps Script deployment |

---

## API routes

| Route | Method | Description |
| --- | --- | --- |
| `/api/catalog?type=asin&q=…` | GET | Looks up a catalog item through Synccentric |
| `/api/orders` | POST | Validates the order, appends it to the ledger, generates the QR code and creates the Notion page |
| `/api/health` | GET | Reports which services are configured (never returns secret values) |

---

## Project structure

```
app/
  api/catalog/route.ts     Synccentric lookup proxy
  api/orders/route.ts      Order submission pipeline
  api/health/route.ts      Configuration status
  layout.tsx, page.tsx     Landing page
components/
  order/                   Order form, catalog lookup, confirmation
  ui/                      shadcn/ui components
lib/
  orders/schema.ts         Shared zod order schema
  server/                  env, errors, synccentric, ledger, qr, notion, orders
google-apps-script/        Code.gs + appsscript.json (immutable ledger)
next.config.mjs            Security headers
vercel.json                Pins the Next.js framework preset
```

---

## Deployment

The project deploys to Vercel as a Next.js app. `vercel.json` pins `"framework": "nextjs"` so Vercel uses the `.next` build output.

If you see `No Output Directory named "public" found`, go to **Project Settings → Build & Deployment**. Set **Framework Preset** to *Next.js* and clear any **Output Directory** override.
