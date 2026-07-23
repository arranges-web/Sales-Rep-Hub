# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Joshua Tree Sales App (`artifacts/sales-app`)

Internal sales rep app for Joshua Tree Inc. (myjoshuatree.com), SWFL crew.

- **Auth**: Username + optional shared team password. No Clerk, no OAuth. `POST /api/auth/login` takes `{ name, password? }`, slugifies the name to a stable id (`local:<slug>`), auto-registers on first use (first rep becomes admin), and returns an HMAC-signed token (`lib/authToken.ts`). The client stores it in `localStorage` and attaches it as a bearer via `setAuthTokenGetter` (`lib/auth.tsx`); `requireAuth` verifies it. The shared password is hashed in `app_settings.team_password_hash` and managed in Admin → Access. Unset = open access (needed to bootstrap the first admin). The signing secret self-generates into `app_settings.auth_secret` so sessions survive restarts. `usersTable.clerkId` is reused as the `local:<slug>` identity column — no schema change. The `@clerk/*` deps remain in package.json but are unused.
- **Branding**: Leaf green `#3DA935` (primary), deep forest green `#2C8214` (secondary), gold `#FFBF00` (accent), woodgrain `#C6702A` — matches the logo wordmark. Map "lead" pins are teal `#14B8A6` to stay distinct from the green chrome/sold pins. No blue anywhere. Tokens in `artifacts/sales-app/src/index.css`; primary HSL `116 51% 43%`.
- **Company**: Joshua Tree Inc., myjoshuatree.com — ISA certified arborists, Cape Coral / Fort Myers / SWFL.
- **Pages**: Landing, Dashboard (Points to Paradise + tier progress), Leaderboard (with tier cutoff lines), Hype Feed (with bot posts + high-fives + comments), Canvassing Map (pins + territories), My Deals, Incentive Vault, Training Vault, Admin Panel (Reps/Tiers/Points/Rewards/Redemptions/Training/Territories tabs).
- **Points**: `pointsForDeal(serviceType, amount)` → reads `point_configs.pointsPer100`, default 10 pts per $100 (`artifacts/api-server/src/lib/points.ts`).
- **Auto badges on deal close**: Century Club ($10k+ in a single deal), Hat Trick (3 deals closed same day), First Deal.
- **Bot feed posts** on deal close: `authorId: null`, `isBot: true`, `authorName: "Joshua Tree Bot"`.
- **Codegen workflow**: `pnpm --filter @workspace/api-spec run codegen` runs orval → `lib/api-spec/fix-zod-index.mjs` (rewrites zod barrel) → libs typecheck. Don't add `schemas` output back to `orval.config.ts`.
- **Schema**: 15 tables in `lib/db/src/schema/index.ts` (incl. `app_settings`). Push with `pnpm --filter @workspace/db run push-force` in dev.
- **Go live / demo data**: `app_settings.demo_data_enabled` gates every demo seeder, including the starter deals handed to a brand-new real rep (`seedDataForNewRep`). Admin → Go Live previews the row counts (`GET /api/admin/demo-data`) and purges them (`POST /api/admin/demo-data/purge` with `{"confirm":"GO LIVE"}`). The purge flips the flag off *before* deleting so a crash mid-purge can't be undone by the next boot seed. Real users, rewards, tiers, point configs, training and territories are never touched. Purge logic lives in `artifacts/api-server/src/lib/demoData.ts`.
- **Jobber sync** (`artifacts/api-server/src/lib/jobber.ts`): pulls `jobs`, `quotes` and `requests` as three independent passes — one failing connection doesn't block the others, and `lastSyncStatus` becomes `partial`. Each query is attempted with optional fields (`jobberWebUri`) and retried without them on an unknown-field error. Pins carry every client phone (`resident_phones` JSON), email, `external_kind`, `external_client_id` and `external_url`. Quotes map to a `quoted` pin status (approved → `sold`), requests to `requested`. Rep-entered resident info (`residentSource === "rep"`) is never overwritten by a sync.

- **Canvassing map**: Vanilla Leaflet + OSM tiles in `Map.tsx` with marker clustering, click-to-drop with Nominatim reverse geocoding, popups with sold/delete actions. Territory `bounds` stores GeoJSON Polygon strings; admins draw polygons via `TerritoryDrawMap.tsx` (leaflet-draw). Leaflet + plugin CSS imported in `index.css`.
- **Photo upload**: `PhotoUpload.tsx` calls `POST /api/storage/uploads/request-url` → `PUT` to presigned URL → stores `objectPath` (`/objects/...`). Display via `photoServingUrl()` → `/api/storage{objectPath}`. Storage routes are `requireAuth`-gated. Mobile camera capture via `capture="environment"`.

### Known follow-ups
- Server-side request validation (Zod) on admin/mutation endpoints is minimal; rely on OpenAPI types only at the moment.
- E2E test of the full deal→points→badge→feed flow was interrupted; manual smoke recommended.
- Photo serving currently uses authenticated GET on `/api/storage/objects/*`; no per-object ACL check beyond auth.
