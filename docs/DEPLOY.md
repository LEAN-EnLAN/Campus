# Deploying Campus (Vercel + hosted Supabase)

Campus ships as a static SPA. On Vercel there is no Vite dev server, so there is
no Vault API: a hosted build is built with `VITE_CAMPUS_VAULT=off`, the startup
picker offers **Campus Cloud** only, and the local Vault keeps working when you
run Campus on your own computer.

Run everything below from the repo root. The Supabase CLI is the repo's own
(`./node_modules/.bin/supabase`, installed by `pnpm install`).

## 0. What is safe to load into the hosted database

`supabase/seed.sql` is **reference data only** (institutions, academic units,
programs, curricula, subjects, curriculum_subjects, prerequisites), insert-only
and idempotent (`on conflict do nothing`). `tests/unit/seed-safety.test.ts`
fails if it ever gains accounts, credentials or writes to anything else.

Tester accounts (`tester-*@tester.campus.local`, password `campus-tester`) are
created by `scripts/tester.mjs` through the admin API of the **local** stack, and
the script refuses to run against any other API. Never create them in the hosted
project, and never run `pnpm tester seed` with hosted credentials.

## 1. Hosted Supabase

Create a project in the Supabase dashboard first (note the **project ref**, the
`<ref>` in `https://<ref>.supabase.co`, and the database password you chose).

```bash
# (a) log in and link
./node_modules/.bin/supabase login                       # opens a browser; or: --token <access-token>
./node_modules/.bin/supabase link --project-ref <ref> --password "$DB_PASSWORD"

# Preview what would run, then apply migrations + the reference seed
./node_modules/.bin/supabase db push --dry-run
./node_modules/.bin/supabase db push --include-seed
```

`db push` targets the linked project; `--include-seed` loads the files listed in
`[db.seed] sql_paths` of `supabase/config.toml` (`./seed.sql`). Re-running is
safe: migrations already on the remote are skipped and the seed is idempotent.

Alternative for the seed only, with `psql` and the connection string from the
dashboard (Connect > Session pooler):

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
```

Check it landed:

```bash
./node_modules/.bin/supabase migration list --linked
psql "$DB_URL" -c "select count(*) from public.subjects;"
```

> Do **not** run `supabase config push`. It pushes the local `config.toml`
> (Site URL `http://127.0.0.1:3000`, local auth settings) over the hosted
> project. Configure Auth in the dashboard as described next.

Regenerating the seed (`pnpm seed:generate`) or the catalog is a code change:
commit the result, then push again.

## 2. Supabase Auth settings (dashboard > Authentication)

- **URL Configuration > Site URL**: `https://<your-domain>` (the production
  Vercel domain, e.g. `https://campus.vercel.app` or your custom domain).
- **URL Configuration > Redirect URLs**: add `https://<your-domain>/**`. For
  preview deployments also add `https://*-<team-slug>.vercel.app/**`.
- **Sign In / Providers > Email > Confirm email**: recommended **off** for now.
  The app signs a new student in and goes straight to `/today`; it has no
  "check your inbox" screen and does not consume the confirmation link
  (`detectSessionInUrl: false`). With confirmation **on**, a new account gets no
  session and lands back on login without an explanation, and the student has to
  confirm by e-mail and then sign in by hand. If you need confirmation, add that
  screen first. With it off, consider enabling CAPTCHA/rate limits against
  throwaway signups.
- Leave anonymous sign-ins disabled (the local config does too).

## 3. Vercel environment variables

All `VITE_*` values are inlined into the public bundle at **build** time, so
changing one requires a new deployment.

| Variable                 | Value                       | Environments         | Public? |
| ------------------------ | --------------------------- | -------------------- | ------- |
| `VITE_SUPABASE_URL`      | `https://<ref>.supabase.co` | Production + Preview | yes     |
| `VITE_SUPABASE_ANON_KEY` | the project's **anon** key  | Production + Preview | yes     |
| `VITE_CAMPUS_VAULT`      | `off`                       | Production + Preview | yes     |

The anon key is designed to be public: Row Level Security is what protects the
data. Find it in the dashboard under Project Settings > API Keys.

**Never set** (they are secrets or tooling that must not ship):

- `SUPABASE_SERVICE_ROLE_KEY`: bypasses RLS. Node-only, never `VITE_`-prefixed.
- The database password / `DB_URL`: only on your machine for step 1.
- `VITE_CAMPUS_TESTER`: enables `/dev` one-click login with a published
  password. It is ignored whenever `VITE_CAMPUS_VAULT=off`, but do not set it.
- Anything else prefixed `VITE_` that is not meant to be public.

```bash
vercel login
vercel link                                   # create/link the project; framework and commands come from vercel.json
printf %s "https://<ref>.supabase.co" | vercel env add VITE_SUPABASE_URL production
printf %s "<anon-key>"                | vercel env add VITE_SUPABASE_ANON_KEY production
printf %s "off"                       | vercel env add VITE_CAMPUS_VAULT production
# repeat the three lines with `preview` instead of `production` if you use previews
```

## 4. Deploy

```bash
pnpm install --frozen-lockfile
VITE_CAMPUS_VAULT=off VITE_SUPABASE_URL=https://<ref>.supabase.co \
  VITE_SUPABASE_ANON_KEY=<anon-key> pnpm build
pnpm deploy:check                              # optional: scans dist/ for tester creds, service_role keys, local URLs

vercel --prod
pnpm deploy:check --url https://<your-domain>  # optional: deep link, missing-asset 404, immutable cache
```

`vercel.json` pins the install (`pnpm install --frozen-lockfile`), build
(`pnpm build`) and output (`dist`), rewrites every non-file path to
`/index.html` (a refresh on `/courses/...` works; missing `/assets/*` and
`/academic-catalog/*` stay real 404s) and caches `/assets/*` for a year as
immutable. `pnpm build` needs no Docker or local Supabase: the generated files
`tsc -b` needs (`src/routeTree.gen.ts`, `src/lib/db/database.types.ts`) are
committed.

Smoke test by hand: open the domain, confirm the picker shows only Campus
Cloud, create an account, and reload on a deep link.
