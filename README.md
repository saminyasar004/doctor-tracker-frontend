# Doctor Tracker — Admin Portal

React admin portal for the **Doctor Tracker API**: manage doctors, manage the patients assigned to them,
and read practice analytics.

The app is a thin, well-typed client over a REST backend. Every list, filter, sort and aggregate comes
from the API — there is no mock data and no client-side aggregation of large collections.

---

## Table of contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [Architecture notes](#architecture-notes)
- [Design system](#design-system)
- [Screens](#screens)
- [Testing](#testing)
- [Deploying](#deploying)
- [Troubleshooting](#troubleshooting)

---

## Stack

| Concern         | Choice                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| Framework       | React 19 + TanStack Start (Vite 8, file-system routing)                              |
| Language        | TypeScript in strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| Server state    | TanStack Query (`keepPreviousData`, invalidation on mutation)                        |
| Forms           | React Hook Form + Zod                                                                |
| UI              | shadcn/ui (Radix) primitives on Tailwind CSS v4                                      |
| Charts          | Recharts                                                                             |
| Animation       | Framer Motion                                                                        |
| Icons           | lucide-react                                                                         |
| Dates           | date-fns                                                                             |
| Package manager | bun                                                                                  |

---

## Getting started

The backend must be running (it serves the data this app displays). From the repository root:

```bash
# terminal 1 — API on :4000
cd doctor-tracker-backend
yarn install
yarn prisma migrate dev
yarn prisma db seed
yarn start:dev

# terminal 2 — this app on :3000
cd doctor-tracker-frontend
bun install
bun run dev
```

Then open **http://localhost:3000** and sign in:

| Email                     | Password      |
| ------------------------- | ------------- |
| `admin@doctortracker.com` | `Admin@12345` |

---

## Environment variables

Copy `.env.example` to `.env` (or export the variable in your shell):

| Variable       | Required | Default                        | Description                                                        |
| -------------- | -------- | ------------------------------ | ------------------------------------------------------------------ |
| `VITE_API_URL` | no       | `http://localhost:4000/api/v1` | Base URL of the Doctor Tracker API                                 |
| `PORT`         | no       | `3000`                         | Dev/preview server port (must match the backend's CORS allow-list) |

`VITE_API_URL` is inlined at build time, so rebuild after changing it in production.

---

## Scripts

| Script                | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `bun run dev`         | Dev server with HMR on :3000                                         |
| `bun run build`       | Production build to `dist/` (client + server bundle)                 |
| `bun run preview`     | Serves the production build locally                                  |
| `bun run typecheck`   | `tsc --noEmit`                                                       |
| `bun run lint`        | ESLint (flat config, includes Prettier)                              |
| `bun run format`      | Prettier, write mode                                                 |
| `bun run test`        | Vitest unit tests                                                    |
| `bun run smoke`       | Headless-Chrome journey: create → search → profile → delete a doctor |
| `bun run screenshots` | Headless-Chrome captures of every screen into `docs/screenshots/`    |

`smoke` and `screenshots` drive a real browser over the DevTools protocol and need both the API
and the dev server running, plus Chrome available at `/usr/bin/google-chrome`.

---

## Project layout

```
src/
├── routes/                     # one file per route (TanStack file-system routing)
│   ├── __root.tsx              # html shell, theme init, error + 404 pages
│   ├── login.tsx
│   ├── _app.tsx                # authenticated shell: sidebar + topbar
│   ├── _app.dashboard.tsx
│   ├── _app.doctors.index.tsx  # doctors list
│   ├── _app.doctors.$id.tsx    # doctor profile + their patients
│   └── _app.patients.tsx       # global patient workspace
├── components/
│   ├── ui/                     # shadcn primitives (unmodified upstream)
│   ├── common/                 # data-table, filters, pagination, states, badges, …
│   ├── forms/                  # doctor-form, patient-form, combobox
│   ├── charts/                 # recharts wrappers
│   └── layout/                 # sidebar, topbar, command palette, logo
├── lib/
│   ├── api/                    # typed API client (client.ts, auth, doctors, patients, dashboard, mappers)
│   ├── queries.ts              # TanStack Query factories + cache keys
│   ├── types.ts                # domain models mirroring the API
│   └── search-params.ts        # URL search param parsers
├── hooks/
└── styles.css                  # Tailwind v4 theme tokens
```

---

## Architecture notes

**All data access goes through `src/lib/api/`.** Components never call `fetch`; they call typed
functions that unwrap the API's `{ success, data, meta }` envelope and throw an `ApiError` carrying
the HTTP status and field-level errors.

**Filters live in the URL.** Search, every filter, the sort column and the page number are search
params, so a view is shareable and the back button behaves. Changing a filter resets to page 1.

**Search is debounced (300 ms)** and lists use `keepPreviousData`, so paging and filtering never
blank the table.

**Null handling is centralised.** The API returns `null` for absent optional columns; `mappers.ts`
converts those to optional properties once, so components deal with one shape.

**Auth uses both mechanisms the API offers.** The backend sets httpOnly cookies _and_ returns the
access token; the client sends `Authorization: Bearer` (mirrored in `localStorage` so a reload keeps
the session) and `credentials: "include"`. A `401` triggers exactly one silent
`POST /auth/refresh` and a replay of the original request before giving up.

**Mutations invalidate what they change.** A doctor create/update/delete invalidates the doctor
lists, the filter options and the dashboard in one round, because the patient counts shown on the
doctors table and in the charts are derived from the same data.

**Routes are thin.** They compose `components/common` and `components/forms`; the only page-level
logic is URL state and the query/mutation wiring.

---

## Design system

- Primary accent: teal → indigo gradient (`--brand-from` / `--brand-to`); neutral slate surfaces.
- Light and dark themes, both intentional, persisted in `localStorage`, defaulting to the system
  preference. The choice is applied by an inline script before React hydrates, so there is no flash.
- Radix semantics throughout (dialogs, menus, selects, popovers, alerts, tooltips), keyboard
  accessible, with visible focus rings.
- Tables collapse to cards below `md`; filters wrap; the sidebar becomes a drawer on mobile.
- Page transitions fade and slide; table rows animate in and out without re-ordering (shared layout).

---

## Screens

Captured with `bun run screenshots` (real API, seeded data):

| View           | File                                 |
| -------------- | ------------------------------------ |
| Login          | `docs/screenshots/login.png`         |
| Dashboard      | `docs/screenshots/dashboard.png`     |
| Doctors        | `docs/screenshots/doctors.png`       |
| Doctor profile | `docs/screenshots/doctor-detail.png` |
| Patients       | `docs/screenshots/patients.png`      |

---

## Testing

```bash
bun run typecheck   # tsc --noEmit, strict
bun run lint        # eslint, 0 errors
bun run test        # vitest
bun run smoke       # browser journey against the running API
```

`bun run smoke` drives headless Chrome through the real UI: it signs in, creates a doctor through the
form, searches for it, opens its profile and deletes it again, then checks that the patient filters and
pagination work. It cleans up after itself, so it is safe to re-run.

---

## Deploying

The app is a **static SPA**. TanStack Start runs in SPA mode (see `src/start.ts` and the `spa` option in
`vite.config.ts`), so the build emits `dist/client/index.html` plus hashed assets and no Node server is
needed. That is what makes it deployable to Netlify, Cloudflare Pages, S3 or nginx.

```bash
bun install --frozen-lockfile
bun run build          # -> dist/client
```

### Netlify

`netlify.toml` is checked in, so the deploy needs no dashboard configuration beyond the two
environment variables:

```toml
[build]
  command   = "bun install --frozen-lockfile && bun run build"
  publish   = "dist/client"          # NOT "dist" - dist/server is not used on Netlify
```

Two settings do the real work:

| Setting                          | Why                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `publish = "dist/client"`        | The build writes `dist/client` **and** `dist/server`; publishing `dist` leaves the static host unable to find `index.html`.                   |
| `/* -> /index.html` (status 200) | Every route is client-side, so a direct visit to `/doctors` or a refresh must fall back to the SPA shell instead of returning the host's 404. |
| `/assets/* -> 404`               | A missing hashed asset is a real 404; falling back to `index.html` would hand the browser HTML where it expects JavaScript.                   |

The same rules are also in `public/_redirects`, which is copied into the publish directory, so the
fallback still applies if only the files are uploaded.

> Netlify needs **bun** at build time. The `NETLIFY_USE_PNPM`/`NETLIFY_USE_YARN` toggles must be off,
> or replace the command with `npm ci && npm run build`.

### Environment variables

| Where             | Variable       | Value                                                  |
| ----------------- | -------------- | ------------------------------------------------------ |
| Netlify build env | `VITE_API_URL` | `https://<your-api-host>/api/v1`                       |
| **API** env       | `FRONTEND_URL` | `https://doctortracker.netlify.app` (the exact origin) |

Both sides are required. `VITE_API_URL` is inlined at build time, and the API does **not** allow a
wildcard CORS origin because it authenticates with cookies — a mismatch shows up in the browser console
as `net::ERR_FAILED` on every request, with the list stuck on its loading skeleton.

Rebuild after changing `VITE_API_URL`.

### Other hosts

Any static host works; just make sure `/` and every unknown path serve `index.html`:

- **Cloudflare Pages** — build `bun run build`, output `dist/client`; `public/_redirects` is picked up automatically.
- **nginx** — `root /path/dist/client; try_files $uri $uri/ /index.html;`

## Troubleshooting

| Symptom                                        | Cause / fix                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Every page redirects to `/login`               | The token was cleared — sign in again; check the browser console for a `401`                   |
| Sign-in fails with `Invalid email or password` | The API is not seeded: run `yarn prisma db seed` in the backend                                |
| Lists stay empty, network shows `401`          | The access token expired and the refresh call failed (backend down or `FRONTEND_URL` mismatch) |
| "Could not load doctors"                       | The API is unreachable — check `VITE_API_URL` and that the backend is running                  |
| `429 Too Many Requests` on login               | The backend limits login to 5/minute; wait a minute                                            |
| CORS error in the console / list stuck loading | The API's `FRONTEND_URL` does not include this origin (`net::ERR_FAILED`)                      |
| Netlify shows "Page not found"                 | Publish directory must be `dist/client` **and** the SPA redirect must be in place              |
| `bun: command not found` on Netlify            | Turn off the pnpm/yarn toggles so Netlify uses bun                                             |
