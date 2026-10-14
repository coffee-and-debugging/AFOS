# AFOS — Restaurant OS

Restaurant management in one app: point of sale and billing, a live kitchen display, table QR ordering,
stock with automatic recipe deduction, purchases, customers and reports.

## Modules

| Sidebar | What it does | Who can use it |
|---|---|---|
| **Dashboard** | Today's sales, open bills, occupied tables, kitchen load, 7-day chart, top sellers, low stock | admin, cashier |
| **Menu** | Items, photos, categories, availability, and per-item **recipes** (ingredients used per serving) | admin |
| **Tables & QR** | Live floor: free/occupied, open bill per table; take an order, settle a bill, print table QR codes | admin, cashier (QR/add/remove: admin) |
| **POS / Billing** | Counter ordering: dine-in or takeaway, customer lookup, discount, service charge and VAT, cash/card/eSewa/Khalti, change due, printable receipts; settle open bills | admin, cashier |
| **Purchases** | Record deliveries from suppliers (adds to stock, updates cost), mark paid/unpaid, void; manage suppliers | admin |
| **Stock** | Ingredients on hand, reorder levels, stock value, adjustments and wastage, full movement history | admin; chef can view and adjust |
| **Customers** | Customer list with visits and lifetime spend, profile with order history | admin, cashier |
| **Orders** | Every order by date range, status, type; change status, cancel (returns stock), bill and reprint | admin, cashier |
| **Kitchen** | Ticket board that refreshes every 5 s; start cooking → ready → served | everyone |
| **Reports** | Net/gross sales, discounts, service charge, VAT, cost of goods and gross profit, sales by day, category, payment method and hour, top items; CSV export and print | admin |

**Plans**: premium features (currently **Customers**) need the `pro` plan. On `free`, the page shows an upgrade
screen, the sidebar shows a lock, and the API answers `402 feature_locked`. Existing installs are `pro`;
change it with `npm run plan -- free|pro` until a billing provider is connected.

**How the numbers work**
- Bill = subtotal − discount, + service charge (dine-in only), + VAT on that amount. Rates are set in **Settings**.
- Selling an item deducts its recipe ingredients from stock; cancelling the order puts them back. Purchases add stock
  and set the item's latest cost, which is used for stock value and cost of goods.

| Part | Tech | Folder |
|---|---|---|
| Web app | React 19 + Vite + TypeScript | `src/` |
| API | Node + Express + Prisma | `server/` |
| Database | PostgreSQL 16 (Docker) | `docker-compose.yml` |

> `AFOS.Desktop/` is a separate Avalonia desktop app and is not covered by this README.

---

## Quick start (any laptop)

**Prerequisites:** [Node.js 20+](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running).

```bash
# 1. Clone
git clone <your-repo-url> afos
cd afos

# 2. Create your .env from the template, then edit it:
#    set POSTGRES_PASSWORD (and the same password inside DATABASE_URL) and JWT_SECRET
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# 3. Install web dependencies
npm install

# 4. Start everything: database + API (migrations and seed run automatically) + web app
npm start
```

Open **http://localhost:5173** and sign in:

| Account | Lands on | Password (from `.env`) |
|---|---|---|
| `admin` (owner/manager) | Dashboard | `SEED_ADMIN_PASSWORD` (default `admin123`) |
| `cashier` (front of house) | POS / Billing | `SEED_CASHIER_PASSWORD` (default `cashier123`) |
| `chef` (kitchen) | Kitchen | `SEED_CHEF_PASSWORD` (default `chef123`) |

A guest menu is at **http://localhost:5173/table/table-1**. A brand-new database is seeded with a demo restaurant
(17 menu items with recipes, 15 stock items, 3 suppliers, 8 tables). An existing database is never overwritten;
run `npm run db:demo` to add the demo menu, stock and suppliers to it.

`npm start` = `npm run up` (Docker: Postgres, API, backups — waits until healthy) followed by `npm run dev` (Vite).
Next time, if the containers are already running, `npm run dev` is enough. They restart automatically with Docker Desktop.

### The second laptop

Exactly the same steps. Nothing is machine-specific: the database lives in a Docker volume and is created,
migrated and seeded on first start. To bring over real data from the first laptop, see [Backups](#backups--restore).

### Step-by-step (without the one-liner)

Use this if you want to run the API on your machine (for example to debug it with hot reload):

```bash
npm install                 # web dependencies
npm run server:install      # API dependencies (also generates the Prisma client)
npm run db:up               # start only Postgres in Docker, wait until healthy
npm run db:migrate          # apply migrations   (safe to re-run)
npm run db:seed             # seed demo data     (safe to re-run, never duplicates)
npm run dev:local           # Vite + API with auto-reload, side by side
```

Don't run `dev:local` while the Docker `api` container is running, because both use port 3001. Stop it first with `docker compose stop api`.

### All scripts

| Command | What it does |
|---|---|
| `npm start` | Docker stack up + web dev server |
| `npm run up` / `npm run down` | Start / stop Postgres, API and backup containers |
| `npm run logs` | Follow the API's logs |
| `npm run dev` | Web app only (proxies `/api` to `localhost:3001`) |
| `npm run dev:local` | Web app + API running locally (needs `npm run db:up`) |
| `npm run build` / `npm run preview` | Production build / serve the build at http://localhost:4173 |
| `npm run lint` | ESLint for web and API code |
| `npm run db:migrate` / `db:seed` / `db:setup` | Migrations / seed / both, against `DATABASE_URL` |
| `npm run plan -- free\|pro` | Show or change the subscription plan (gates premium features such as Customers) |
| `npm run db:demo` | Add the demo restaurant (menu, stock, recipes, suppliers) to an existing database. Safe to re-run |

---

## Configuration

Everything lives in **one root `.env`** (template: `.env.example`), shared by docker compose, the API, Prisma and Vite.
The API validates it on startup and exits with a clear list of anything missing or invalid.

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | – | compose | default `afos` |
| `POSTGRES_PASSWORD` | ✔ | compose | |
| `POSTGRES_PORT` | – | compose | host port, default **5433** (avoids a local Postgres on 5432) |
| `DATABASE_URL` | ✔ | API, Prisma | for running outside Docker; compose builds its own |
| `JWT_SECRET` | ✔ | API | ≥ 16 chars. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `API_PORT` | – | API, Vite proxy | default 3001 |
| `CORS_ORIGINS` | – | API | comma-separated frontend origins |
| `LOG_LEVEL` | – | API | `debug` / `info` / `warn` / `error` |
| `SEED_ADMIN_PASSWORD` / `SEED_CASHIER_PASSWORD` / `SEED_CHEF_PASSWORD` | ✔ in prod | seed | only used when the account doesn't exist yet |
| `BACKUP_RETENTION_DAYS` | – | backup | default 14 |
| `VITE_SALES_EMAIL` / `VITE_UPGRADE_URL` | – | browser | Where "Contact sales" / "Upgrade" go on the Feature locked page |
| `VITE_API_URL` | – | browser | API origin in production; empty in development. Only `VITE_*` values reach the browser, so never put secrets in them. |

---

## Database

**PostgreSQL**, accessed through **Prisma**. The data is relational (orders → order items → menu items → categories,
orders → tables). It needs transactions and constraints, for example "a category can't be deleted while items use it".
That makes Postgres the natural fit, and it was already in use.

Tables: `User`, `Restaurant` (details, currency, tax and service-charge rates — one row), `Category`, `MenuItem`,
`RecipeItem` (ingredients per menu item), `Table`, `Customer`, `Order` (bill number, type, discount, service charge,
tax, payment), `OrderItem`, `Supplier`, `Purchase`, `PurchaseItem`, `StockItem`, `StockMovement` (every stock change,
with its reason).

- **Migrations** live in `server/prisma/migrations/` and are applied with `prisma migrate deploy`. Prisma records what has
  run, so re-running is a no-op. The newest migration is also written defensively (`IF NOT EXISTS`).
- **Seed** (`server/prisma/seed.js`) only creates what's missing: users, restaurant settings and categories are upserts,
  menu items are only added to an empty menu, and the four tables are upserted. Edits made in the admin panel are never overwritten.
- In Docker, the API container runs migrate + seed on every start (`server/docker-entrypoint.sh`).

---

## Reliability

| Failure | What happens |
|---|---|
| API starts before Postgres | Compose waits for the DB health check. The API also retries the connection with backoff for ~4 min. |
| Postgres restarts mid-service | Requests return `503` JSON; Prisma reconnects automatically; the UI shows "Reconnecting" and keeps the last data on screen. |
| API crashes (uncaught exception) | Logged as `fatal`, process exits, Docker `restart: unless-stopped` starts a fresh one within seconds. |
| Unhandled promise rejection | Logged as `error`; the process keeps serving. |
| Bad request / unknown route | Clean JSON error (`400/404/409`), never a stack trace. |
| Browser loses the API | Reads retry 3× with backoff. If they still fail, an offline banner appears and `/api/health` is polled every 5 s until the API is back. Then everything resumes on its own. |
| A React render error | The error boundary shows a "Reload" screen instead of a blank page. |
| Session expired | User is sent to the login page with a message. |

- **Health check:** `GET /health` (and `/api/health`) → `200 {"status":"ok","db":"up",…}` or `503` if the database is down.
  Docker uses it as the container health check.
- **Logs** are one JSON object per line: `npm run logs`, or `docker compose logs api | grep '"level":"error"'`.

---

## Backups & restore

The `backup` container writes `backups/afos-YYYY-MM-DD_HHMM.sql.gz` on start and then every 24 h, and keeps
`BACKUP_RETENTION_DAYS` days. Copy that folder somewhere off the laptop (cloud drive, USB) regularly.

```bash
# Manual backup right now
docker compose exec -T db pg_dump --clean --if-exists --no-owner -U afos afos > backups/manual.sql

# Restore (replaces current data). PowerShell: use `docker compose cp` + `exec` as below instead of the pipe.
gunzip -c backups/afos-2026-10-14_0900.sql.gz | docker compose exec -T db psql -U afos -d afos
```

On Windows PowerShell:

```powershell
docker compose cp backups\afos-2026-10-14_0900.sql.gz db:/tmp/restore.sql.gz
docker compose exec db sh -c "gunzip -c /tmp/restore.sql.gz | psql -U afos -d afos"
```

**Moving data from your old local Postgres (pgAdmin, port 5432) into Docker:**

```bash
pg_dump --clean --if-exists --no-owner -h localhost -p 5432 -U postgres afos > old.sql
docker compose cp old.sql db:/tmp/old.sql
docker compose exec db psql -U afos -d afos -f /tmp/old.sql
docker compose restart api        # re-applies any newer migrations + seed
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AFOS API cannot start: invalid configuration` | The message lists the missing variables. Copy `.env.example` to `.env` and fill them in. |
| `npm run up` fails with `Set POSTGRES_PASSWORD in .env` | Same: `.env` is missing or incomplete. |
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop isn't running. Start it and wait for "Engine running". |
| `port is already allocated` (5433 / 3001) | Another program uses the port. Change `POSTGRES_PORT` / `API_PORT` in `.env`, or stop the other program. |
| Web app shows "We can't reach the server" | `docker compose ps`. If `api` isn't `healthy`, run `npm run logs`. It recovers by itself once the API is up. |
| API logs `database not reachable, retrying` | Postgres is still starting or stopped: `docker compose up -d db`. |
| `P3005 The database schema is not empty` | The DB was created by hand before migrations existed. Mark the old migrations as applied once: `cd server && node scripts/prisma.js migrate resolve --applied 20240101000000_init` (repeat for `…01_menu_autoincrement` and `…02_menu_image`), then `npm run db:migrate`. |
| `password authentication failed` after changing `POSTGRES_PASSWORD` | Postgres keeps the password from the volume's first start. Change it back, or (this **deletes data**) `docker compose down -v`. |
| Images missing after moving laptops | Uploaded photos live in `server/uploads/` (not in git). Copy that folder across too. |
| Login keeps sending you back | Your session expired, or `JWT_SECRET` changed. Sign in again. |
| A page sends you somewhere else | That role can't open it (e.g. the chef can't open Reports). Sign in as admin. |
| Stock didn't change after a sale | The menu item has no recipe. Add its ingredients in **Menu → Edit item**. |
| Stock shows a negative quantity | More was sold than was recorded as bought. Record the missing purchase or make an adjustment in **Stock**. |
| Receipt prints the whole page | Use the **Print** button inside the bill window; set the printer's paper to your receipt width (e.g. 80 mm). |
| Entry script fails with `\r: not found` | The script was checked out with Windows line endings. `git rm --cached -r . && git reset --hard` after pulling `.gitattributes`. |

---

## Deploying

The recommended split is **frontend on Vercel or Netlify** and **API + Postgres on Render or Railway**.

### API + database (Render example)

1. **New → PostgreSQL** (any plan with daily backups, i.e. a paid instance). Copy its *Internal Database URL*.
2. **New → Web Service** from this repo:
   - Root directory: `server` · Runtime: **Docker** (uses `server/Dockerfile`)
   - Health check path: `/health`
   - Environment:
     | Key | Value |
     |---|---|
     | `DATABASE_URL` | the internal URL from step 1 |
     | `JWT_SECRET` | long random string |
     | `CORS_ORIGINS` | your frontend URL, e.g. `https://afos.vercel.app` |
     | `SEED_ADMIN_PASSWORD`, `SEED_CASHIER_PASSWORD`, `SEED_CHEF_PASSWORD` | strong passwords |
     | `TRUST_PROXY` | `true` |
   - Add a **persistent disk** mounted at `/app/uploads` so menu photos survive deploys.
3. **Migrations on deploy** happen automatically: the container's entrypoint runs `prisma migrate deploy` and the
   idempotent seed before starting the server. A failed migration stops the deploy, and the previous version keeps running.

Railway works the same way: add a Postgres plugin, deploy `server/` with its Dockerfile, set the same variables,
attach a volume at `/app/uploads`, and set the health check to `/health`.

### Frontend (Vercel or Netlify)

- Build command `npm run build`, output directory `dist`.
- Environment variable: `VITE_API_URL=https://<your-api>.onrender.com` (set before building; it is baked into the bundle).
- Deep links (`/pos`, `/kitchen`, `/table/table-3` …) are handled by `vercel.json` (Vercel) and `public/_redirects` (Netlify),
  which serve `index.html` for every path.
- Print table QR codes from the **deployed** site so they point at the public URL.

### Single-server alternative

`npm run build` puts the web app in `dist/`. The API automatically serves `dist/` (with an SPA fallback) when it exists,
so one Node process (or one VPS running `docker compose`) can host everything.

---

## Uptime & recovery checklist (hosted)

- [ ] Host health check set to `/health` and auto-restart on failure enabled (Render/Railway do this by default for Docker services).
- [ ] [UptimeRobot](https://uptimerobot.com) (free) HTTP(s) monitor on `https://<api>/health`, 5-minute interval, alerting to email/phone.
      A second keyword monitor on the frontend URL is cheap insurance.
- [ ] Managed Postgres with **daily backups** enabled. Check that a backup exists on the first day.
- [ ] Persistent disk attached at `/app/uploads`.
- [ ] `JWT_SECRET` and seed passwords are strong and stored in your password manager.
- [ ] **Monthly restore drill:** restore the latest backup into a scratch database and open the app against it.
- [ ] **When an alert fires:** open the host's logs (JSON lines; filter `"level":"error"` or `"fatal"`) →
      check `/health` (`db: down` means look at the database service; no response means look at the API service) →
      redeploy the last good commit if a release broke it → restore from backup only if data is damaged.
