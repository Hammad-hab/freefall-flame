# Deploy notes (suggestions)

For the teammate who deploys the dashboard. **Everything here is a
suggestion**, not a finished setup: none of it has been tried on a real
host. Where a step says "Suggestion", the code does not do it yet; decide
whether you want it before deploying.

This file names environment variables only. It never contains their
values. Ask the owner for them, and keep them in the host's secret
settings, never in git.

---

## 1. Environment variables (names only)

| Name | Needed? | What it does |
|---|---|---|
| `DATABASE_URL` | **Required** | The Supabase Postgres connection string. It is the **same shared database** used in development. |
| `PAYLOAD_SECRET` | **Required** | Signs admin logins. It must be the same on every server instance. Use a long random value, not the one from someone's laptop. |
| `OPEN_ROUTER` | Optional | The OpenRouter key. Without it the AI panels fall back to the built-in summaries, and no AI money is spent. |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Only for admin media uploads | Used by the S3 storage plugin for the `media` collection. The public dashboard does not need them. |
| `PAYLOAD_PUSH` | **Leave unset** | The schema-push switch (see section 2). Production never pushes anyway. |
| `DATASET_PREVIEW_IDS` | **Leave unset** | Local preview of an unpublished dataset. Ignored in production. |
| `NEXT_TELEMETRY_DISABLED` | Optional | Set to `1` to stop Next.js sending anonymous usage data. |

`NODE_ENV` is set to `production` by `next build` / `next start` and by
most hosts. Don't set it by hand to anything else.

`.env.example` currently lists only the first three. Suggestion: add the
four `S3_*` names and `PAYLOAD_PUSH` to it (names only).

---

## 2. The database schema: why a deploy doesn't change it

- `src/payload.config.ts` has `push: process.env.PAYLOAD_PUSH === 'true'`.
  Schema push is **off by default**: in development, in the tests and in
  production.
- Payload never pushes when `NODE_ENV=production`, whatever the switch
  says.
- No migrations are configured (there is no `prodMigrations`). So a
  deploy runs against the database **as it is now**. The schema there
  already matches the code, because nothing in the collections has
  changed since it was last pushed.
- If a future change touches a collection or field, it needs the owner's
  yes and a plan for the database first. Don't set `PAYLOAD_PUSH=true`
  on the host.
- **Check after deploying:** the host's logs must never show
  `Pulling schema from database...`.

---

## 3. Risks

1. **One shared database.** Development, tests and production all use the
   same Supabase database. A test run or a dev server on someone's laptop
   reads the live data. The push switch stops them changing the schema.
   They can still write data, for example through the admin panel or the
   scripts with `--write`.
2. **AI cost.** The limits in `src/lib/ai-guard.ts` are:
   - 10 new requests per visitor per 10 minutes;
   - 300 paid calls a day;
   - an answer cache.

   All three are **kept in memory, per server instance**. On a serverless
   host with many instances, each one has its own counters and cache, so
   the real daily ceiling is 300 × the number of instances. A restart also
   resets them. See section 6 for the credit limit.
3. **Visitor identity for the rate limit.** The visitor is identified by
   the first address in `x-forwarded-for` (else `x-real-ip`). That is only
   trustworthy if the host sets that header itself (Vercel, Netlify and
   most proxies do). Behind a proxy that passes on the visitor's own
   header, a visitor can change it and dodge the per-visitor limit. The
   daily cap still holds.
4. **Database connections.** The Postgres pool uses the driver's default
   size (10 connections per instance). Many serverless instances × 10 can
   use up Supabase's connection limit. See section 5.
5. **S3 plugin always on.** The plugin is registered even when the `S3_*`
   variables are missing. The site builds and runs without them (checked
   locally), but uploading media in the admin panel would fail. See
   section 5.
6. **Build memory.** `pnpm build` asks Node for up to 8000 MB
   (`--max-old-space-size=8000`). A small build machine may run out of
   memory. Lower that number if the host has less.
7. **The admin panel is public.** `/admin` is reachable by anyone. Use
   strong passwords for admin users. If `PAYLOAD_SECRET` ever leaks,
   change it; everyone then has to log in again.
8. **A harmless build warning.** Next prints
   `Module not found: Can't resolve '.'` for a line inside the sandbox
   engine's generated WebAssembly loader (`new URL(".", ...)`). The
   sandbox loads and runs regardless. It is not an error.

---

## 4. Dockerfile and docker-compose.yml are leftovers

Both come from Payload's starter template. **Neither works for this app
as it is.**

- **`Dockerfile`** copies `.next/standalone`. That folder only exists
  when `next.config.ts` sets `output: 'standalone'`, and it doesn't, so
  the image build would fail at that step. It also uses
  `node:22.17.0-alpine`, which is fine (`package.json` needs Node
  >= 20.18.1).
- **`docker-compose.yml`** starts a **MongoDB** container. This app uses
  Postgres. It also runs `pnpm dev` (development mode, with Payload's dev
  behaviour), `node:20-alpine`, and `pnpm@latest`, which may not match
  `"pnpm": "^9 || ^10 || ^11"` in `package.json`.

Suggestions:
- If you deploy to Vercel or a similar host, you don't need either file.
  Delete them, or mark them as unused.
- If you want Docker, add `output: 'standalone'` to `next.config.ts`,
  keep the Dockerfile, and replace the compose file with one that has
  only the app service and reads the variables in section 1 (no Mongo,
  and `pnpm build` + `node server.js`, not `pnpm dev`).

Either way, it's a code change: ask the owner first.

---

## 5. Suggested code changes (not made)

These were proposed to the owner and are **not** in the code. Each is
small.

**a. A smaller connection pool.** In `src/payload.config.ts`:

```ts
pool: {
  connectionString: process.env.DATABASE_URL || '',
  max: Number(process.env.DATABASE_POOL_MAX ?? 3),
},
```

On serverless, also use Supabase's **transaction pooler**
connection string for `DATABASE_URL`, not the direct database address.
Check which one the current value uses before deploying.

**b. The S3 plugin only when it's configured.** Register `s3Storage(...)`
only when `S3_BUCKET` is set:

```ts
plugins: process.env.S3_BUCKET ? [s3Storage({ /* as now */ })] : [],
```

Without S3, media would then be stored on the server's disk. On a
serverless host that disk is temporary, so set the `S3_*` variables
there if media uploads are needed.

**c. `.env.example`** with every name from section 1 (names only, empty
values).

---

## 6. OpenRouter: set a credit limit on the key

The code's caps are per server instance (risk 2). The one limit that
holds everywhere is OpenRouter's own.

- Make a **separate key for production**, not the development one.
- In OpenRouter's key settings, give it a **credit limit** (a few
  dollars is plenty). One call cost $0.0002–0.0003 in testing, so $1
  is roughly 3,000–5,000 calls.
- If the key ever leaks, delete it in OpenRouter and set a new one on
  the host. Nothing else needs to change.

---

## 7. Step-by-step deploy, with a check after each step

1. **Back up the data first.**
   `pnpm payload run src/scripts/export-datasets.ts`
   - Check: it prints the row count for each dataset and writes
     `.local-checks/backup/datasets-<date-time>.json`. Dataset 4,
     "BASS-II (cleaned)", has 129 rows. Keep the file somewhere safe and
     private. It is read-only on the database.
2. **Set the variables** from section 1 in the host's secret settings.
   - Check: `DATABASE_URL` and `PAYLOAD_SECRET` are set; `PAYLOAD_PUSH`
     and `DATASET_PREVIEW_IDS` are **not** set.
3. **Set the OpenRouter credit limit** (section 6) before `OPEN_ROUTER`
   goes live.
4. **Build** with `pnpm install --frozen-lockfile` then `pnpm build`.
   - Check: the build ends with "Compiled successfully" and
     "Generating static pages (9/9)", and the log has no
     `Pulling schema`.
5. **Start** (`pnpm start`, or the host's own start).
   - Check: the logs have no `Pulling schema` and no database errors.
6. **Check the pages** in a browser:
   - `/` shows the home page;
   - `/dashboard` opens "BASS-II (cleaned)" on the Overview;
   - `/dashboard?dataset=999` shows "Woah, we couldn't find that
     dataset!", not an error;
   - `/sources` lists the 14 PSI tables;
   - `/admin` shows the login page.
7. **Check the tabs:**
   - **Investigations** shows 14 cards and the ranking.
   - **Sandbox** loads the engine and lists the presets with "4 of 26
     scored tests match NASA". Run B14: it should end with "match".
   - **Visualization** shows the outcome and rod-diameter charts.
8. **Check the AI once**, with one question in the Overview assistant.
   - Check: an answer appears, and OpenRouter's activity page shows one
     small charge. Without `OPEN_ROUTER`, the built-in summaries show
     instead.
9. **Check the friendly error** (optional, on a preview deploy only):
   with a deliberately wrong `DATABASE_URL`, `/dashboard` shows
   "Couldn't reach the data, try again" instead of a raw 500.

---

## 8. Switching the data back

The data change is only three `published` flags. Nothing was deleted.

```
pnpm payload run src/scripts/switch-bass2-default.ts -- --to old              # dry run: what would change
pnpm payload run src/scripts/switch-bass2-default.ts -- --to old --write      # publish 2 and 1, unpublish 4
pnpm payload run src/scripts/switch-bass2-default.ts -- --to cleaned --write  # and back again
```

- Visitors see the switch within about 60 seconds (the list cache).
- Restoring from the JSON backup is described in
  `data/README-bass2-clean.md`, "Backup and restore".
- These commands **write to the shared database**. Run the dry run
  first, and only with the owner's yes.
