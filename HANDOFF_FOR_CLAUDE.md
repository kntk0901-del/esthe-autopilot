# Claude Handoff

Updated: 2026-06-14

## Project

`Esthe Growth Autopilot PoC` is a Next.js 16 App Router application for:

- scraping therapist schedules
- generating and approving X post drafts
- posting to X
- importing sales data
- operational and exploratory analytics
- managing store URLs, selectors, accounts, and automation from the UI

The application uses port `3100`. Do not change it to `3000`.

## Start Here

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3100/settings`.

The default configuration is safe:

- `DATA_MODE=mock`
- `X_MOCK_MODE=true`
- Gemini disabled
- Oimachi automatic scraping enabled
- Oimachi automatic X posting disabled

Mock data is held in process memory and resets when the development server
restarts.

## Verified State

The following passed on 2026-06-14:

```powershell
npm test
npm run test:e2e
npm run typecheck
npm run lint
npm run build
npm run test:oimachi-live -- 2026-06-14
```

Unit/integration result: 7 files, 21 tests passed.

The live Oimachi scraper retrieved:

- ちなつ 11:00-18:00
- てるみ 12:00-20:00
- すずか 19:00-04:00

Source: `https://esthe-spa-lounge.com/schedule/`

Publication consent is obtained from all staff at contract time, so
`publication_consent` is no longer a posting gate (decided 2026-06-14).
Unmatched therapists scraped from the schedule are auto-registered to the master
and become eligible for posting the same day. Only shifts with genuine data
anomalies (for example unparseable times) are held back via `review_required`.
The `post-validator` consistency checks (names, times, store, prohibited text)
remain the safety floor before any post is sent.

## Important Implementation Decisions

- Store-level `auto_scrape_enabled` and `auto_post_enabled` are independent.
- Turning automatic posting off still allows schedule retrieval and draft
  generation.
- A global posting switch acts as an emergency kill switch.
- The default evaluation mode is operations-only.
- Sales contribution must not be treated as causal without randomized
  holdout assignment.
- Store schedule jobs are isolated and idempotent.
- QStash can run stores at their configured times.
- Vercel Cron remains a low-cost daily fallback at 09:00 JST.
- Real X posting requires Upstash Redis locking.
- Bot-like clicks are excluded from link metrics.
- X reach/account health can block posting.

## External Services Not Configured

No real credentials are included in this package.

For production or staging, configure:

1. Supabase
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - apply all files in `supabase/migrations/`
   - run `supabase/seed.sql`

2. Upstash Redis
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

3. X API
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_TOKEN_SECRET`
   - use OAuth 1.0a user context with write permission
   - test with a dedicated X account before any real store account

4. QStash, only when per-store execution times are required
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`

5. Gemini, optional
   - `GEMINI_API_KEY`
   - fixed-template generation works without it

Also replace:

- `SETTINGS_ENCRYPTION_KEY`
- `CRON_SECRET`
- `IP_HASH_SALT`
- `ADMIN_EMAILS`

Do not expose service-role keys or other secrets to browser code.

## Recommended Test Order

1. Run in mock mode and confirm all pages and draft/post flows.
2. Run Oimachi live scraping with automatic posting off.
3. Review candidate therapists and publication consent.
4. Configure Supabase and repeat the flow with persistent data.
5. Configure a dedicated X test account and Upstash Redis.
6. Keep approval required and publish one text-only post manually.
7. Test one image, then up to four images.
8. Deploy to Vercel with real secrets in server environment variables.
9. Test Vercel daily Cron.
10. Configure QStash only if store-specific times are needed.
11. Enable automatic posting for one test store only.
12. Observe for several days before enabling additional stores.

## Remaining Work

- Configure and verify the actual Sugamo schedule URL and selectors.
- Replace demo booking URLs and demo X account names.
- Perform Supabase Auth/RLS integration testing.
- Perform real X API posting/media tests for the selected paid plan.
- Perform Upstash Redis and QStash integration tests.
- Add an alert destination such as a webhook or email.
- Replace the npm-distributed `xlsx@0.18.5` before production because its known
  advisories have no npm registry fix.
- Deploy only after the production readiness panel is complete.

## Key Files

- `SPEC.md`: primary design
- `README.md`: setup and operations
- `docs/PRODUCTION_CHECKLIST.md`: production checklist
- `docs/KNOWN_LIMITATIONS.md`: limitations
- `lib/jobs/daily.ts`: daily store workflow
- `lib/jobs/schedule-sync.ts`: scraping workflow
- `lib/scraper/base.ts`: configurable scraper
- `lib/posting/x-client.ts`: X OAuth, media upload, and posting
- `lib/scheduler/qstash.ts`: QStash schedules
- `lib/db/repository.ts`: mock/Supabase repository
- `components/settings/`: administration UI
- `supabase/migrations/`: database schema changes

## Repository Note

At handoff time the repository had no committed history and all project files
were untracked. Create an initial commit after reviewing the package.
