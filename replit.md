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

- **Auth**: Clerk (modal sign-in/sign-up). First registered user is auto-promoted to admin (`artifacts/api-server/src/routes/users.ts`). `AuthSync.tsx` upserts the user to DB on every sign-in. Falls back to `${clerkId}@no-email.local` if no email is present.
- **Branding**: Blue `#2EA3F2`, Green `#2C8214`, Gold `#FFBF00`, Open Sans, rounded-2xl/xl. Tokens in `artifacts/sales-app/src/index.css`.
- **Pages**: Landing, Dashboard (Points to Paradise + tier progress), Leaderboard (with tier cutoff lines), Hype Feed (with bot posts + high-fives + comments), Canvassing Map (pins + territories), My Deals, Incentive Vault, Training Vault, Admin Panel (Reps/Tiers/Points/Rewards/Redemptions/Training/Territories tabs).
- **Points**: `pointsForDeal(serviceType, amount)` → reads `point_configs.pointsPer100`, default 10 pts per $100 (`artifacts/api-server/src/lib/points.ts`).
- **Auto badges on deal close**: Century Club ($10k+ in a single deal), Hat Trick (3 deals closed same day), First Deal.
- **Bot feed posts** on deal close: `authorId: null`, `isBot: true`, `authorName: "Joshua Tree Bot"`.
- **Codegen workflow**: `pnpm --filter @workspace/api-spec run codegen` runs orval → `lib/api-spec/fix-zod-index.mjs` (rewrites zod barrel) → libs typecheck. Don't add `schemas` output back to `orval.config.ts`.
- **Schema**: 13 tables in `lib/db/src/schema/index.ts`. Push with `pnpm --filter @workspace/db run push-force` in dev.

### Known follow-ups
- Server-side request validation (Zod) on admin/mutation endpoints is minimal; rely on OpenAPI types only at the moment.
- E2E test of the full deal→points→badge→feed flow was interrupted; manual smoke recommended.
