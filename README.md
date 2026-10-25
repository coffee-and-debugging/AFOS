# Yummy Foodland — Restaurant system

Run the restaurant from one app: point of sale and billing, a live kitchen display with an order bell, table QR
ordering with **eSewa and Khalti payments**, stock that deducts down to single loose units, purchases, staff and
payroll, and reports. (The codebase is called AFOS.)

It runs on one computer in the restaurant (the **server PC**). Every other device on the same Wi-Fi, such as the
cashier's laptop, a kitchen tablet, waiters' phones and guests scanning table QR codes, uses it through a browser.
Nothing needs to be installed on those devices.

- [Features](#features)
- [Start the system (first time)](#start-the-system-first-time)
- [Everyday use](#everyday-use)
- [Use it on other devices](#use-it-on-other-devices)
- [Set it up on another computer](#set-it-up-on-another-computer)
- [Online payments (eSewa & Khalti)](#online-payments-esewa--khalti)
- [Commands](#commands) · [Configuration](#configuration) · [Database](#database) · [Live updates](#live-updates)
- [Reliability](#reliability) · [Backups & restore](#backups--restore) · [Troubleshooting](#troubleshooting)
- [Hosting it online](#hosting-it-online)

---

## Features

| Sidebar | What it does | Who can use it |
|---|---|---|
| **Dashboard** | Today's sales, open bills, occupied tables, kitchen load, 7-day chart, top sellers, low stock. Updates the moment an order is placed | admin, cashier |
| **Menu** | Items, photos, categories, availability, and per-item **recipes** (stock used per serving) | admin |
| **Tables & QR** | Live floor plan with the open bill per table; take orders, settle bills, print table QR codes | admin, cashier (QR, add and remove tables: admin only) |
| **POS / Billing** | Dine-in or takeaway, discount, service charge and VAT, cash/card/eSewa/Khalti, change due, printable receipts | admin, cashier |
| **Purchases** | Record supplier deliveries by unit **or by pack** (adds stock, updates cost), paid/unpaid, void; manage suppliers | admin |
| **Stock** | Quantities on hand (shown in packs and loose units), reorder levels, stock value, adjustments and wastage, movement history | admin; chef can view and adjust |
| **Orders** | Every order by date, status and type; change status, cancel (returns stock), reprint bills | admin, cashier |
| **Kitchen** | Ticket board. New orders appear **instantly** with a **bell sound and a popup**; start cooking → ready → served | everyone |
| **Staff & Payroll** | **Create Cashier and Kitchen accounts**, staff directory, departments/categories, deactivation, salary, bonus, overtime, deductions, payment history and CSV export | admin |
| **Reports** | Net/gross sales, discounts, service charge, VAT, cost of goods, gross profit, sales by day/category/payment/hour, top items; CSV and print | admin |

**Low-stock alerts.** After every sale, adjustment or voided purchase the stock levels are checked. When an item drops
to or below its reorder level, or runs out, the admin and cashier screens show a popup with a chime. A bell in the top
bar lists everything that is currently low.

**Selling single units out of a pack** (for example one cigarette from a pack of 20):
1. **Stock → Add item**: unit `pcs`, pack name `pack`, `20` per pack. Stock is then counted in single pieces.
2. **Menu**: create *Cigarette (single)* with a recipe of **1 pcs**, and *Cigarette pack* with **20 pcs**.
3. **Purchases**: buy it "by pack". 2 packs at Rs. 400 are stored as 40 pcs at Rs. 20.

If an item is already counted in packs, use **Stock → Edit → Convert to loose units**. It rescales the stock,
reorder level, cost, recipes and history in one step.

**How the bill is calculated.** Subtotal − discount, + service charge (dine-in only), + VAT on that amount. Rates are set
in **Settings**. Selling an item deducts its recipe from stock and cancelling the order puts it back.

**Guest ordering.** Guests scan the table QR code, order, and land on a tracking page with a **Back to menu** button
to order more. They can pay there with **eSewa or Khalti**, or at the counter. Items switched off in **Menu** show as
**Not Available**.

| Part | Tech | Folder |
|---|---|---|
| Web app | React 19 + Vite + TypeScript | `src/` |
| API | Node + Express + Prisma, Server-Sent Events for live updates | `server/` |
| Database | PostgreSQL 16 (Docker) | `docker-compose.yml` |
| Desktop app (optional) | Avalonia + .NET 8, talks to the database directly | `AFOS.Desktop/` (see its own README) |

---

## Start the system (first time)

Do this on the computer that will act as the server.

**You need:** [Node.js 20+](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/).
Docker Desktop must be open and show "Engine running".

```bash
# 1. Get the code
git clone <your-repo-url> afos
cd afos

# 2. Create your settings file from the template
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
```

3. Open `.env` and change at least these:
   - `POSTGRES_PASSWORD`: any password. Put the **same** password inside `DATABASE_URL`.
   - `JWT_SECRET`: a long random string. Generate one with
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
   - `SEED_ADMIN_PASSWORD`, `SEED_CASHIER_PASSWORD`, `SEED_CHEF_PASSWORD`: passwords for the first three accounts.

```bash
# 4. Install and start (database + API + web app)
npm install
npm start
```

The first start takes a few minutes while Docker builds the API. When it's done, open **http://localhost:5173** and sign in:

| Account | Opens on | Password |
|---|---|---|
| `admin` (owner/manager) | Dashboard | `SEED_ADMIN_PASSWORD` |
| `cashier` (front of house) | POS / Billing | `SEED_CASHIER_PASSWORD` |
| `chef` (kitchen) | Kitchen | `SEED_CHEF_PASSWORD` |

The seed passwords only apply the first time an account is created. After that, the admin creates everyone else's
account in **Staff & Payroll**:
- **Add cashier** creates a sign-in for the POS / billing screens.
- **Add kitchen staff** creates a sign-in for the kitchen display and stock.
- **Add staff** covers any other role, including payroll-only staff (waiters, cleaners) who never sign in.

A brand-new database comes with a demo restaurant: 17 menu items with recipes, 15 stock items, 3 suppliers, 8 tables
and 5 staff departments. It never overwrites an existing database. `npm run db:demo` adds the demo menu to an
existing one.

---

## Everyday use

| Situation | What to do |
|---|---|
| Start of the day, or after restarting the PC | Open Docker Desktop (the database and API start by themselves), then run `npm run dev` in the project folder |
| Close for the day | Close the terminal running `npm run dev`. The database can keep running; `npm run down` stops it |
| You pulled new code or changed anything in `server/` | Run **`npm run up`**. It rebuilds the API and applies database changes. The web app updates by itself, but the API only picks up changes when it's rebuilt |
| Something looks broken | `npm run logs` shows what the API is doing. See [Troubleshooting](#troubleshooting) |

> If a page fails right after an update (e.g. **Staff & Payroll** shows an error), the API is almost always still on
> the old build. Run `npm run up`, then reload the browser with **Ctrl+Shift+R**.

---

## Use it on other devices

Any phone, tablet or laptop **on the same Wi-Fi/network** as the server PC can use AFOS in its browser. The server
PC has to stay on with `npm run dev` running.

### 1. Find the server PC's address

When `npm run dev` starts, it prints the addresses it's reachable on:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.25:5173/
```

Use the **Network** address of your Wi-Fi or Ethernet connection. If several are listed, run `ipconfig` (Windows) and
take the *IPv4 Address* under **Wireless LAN adapter Wi-Fi** (or **Ethernet adapter**); addresses from Docker/WSL
adapters (often `172.x`) won't work from other devices. The examples below use `192.168.1.25`. Replace it with yours.

### 2. Allow it through the Windows firewall (once)

The first time Node.js runs, Windows may ask whether to allow it on networks. Tick **Private networks** and allow it.
If you missed that, run this once in **PowerShell as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "AFOS web app" -Direction Inbound -Protocol TCP -LocalPort 5173,4173 -Action Allow -Profile Private
```

Also check that your Wi-Fi is set to **Private** in Windows (Settings → Network & internet → Wi-Fi → your network →
*Private network*). On a *Public* network Windows blocks incoming connections.

### 3. Open it on each device

| Device | Open | Sign in as |
|---|---|---|
| Cashier laptop / tablet | `http://192.168.1.25:5173` | a cashier account |
| Kitchen tablet or screen | `http://192.168.1.25:5173/kitchen` | a kitchen (chef) account |
| Manager's phone | `http://192.168.1.25:5173` | admin |
| Guests | scan the table QR code (below) | no account needed |

Tips:
- **Kitchen bell:** browsers only play sound after you touch the page once. After opening or reloading the kitchen
  screen, tap the yellow *"Tap here once to enable the order bell"* bar. Keep the tablet's volume up and stop it from
  going to sleep while the kitchen is open.
- **Add to home screen:** in Chrome or Safari, use *Add to Home screen* so staff can open AFOS like an app.
- Each device signs in separately and stays signed in for 12 hours.

### 4. Print the table QR codes

In **Tables & QR**, each table's QR code opens an address like:

```
http://192.168.1.25:5173/table/k7m2x9qa4fpe/
```

- **The address** is the server PC's network address, even when you're using AFOS on the PC itself at `localhost`.
  AFOS detects the Wi-Fi/Ethernet address and skips virtual adapters (WSL, Docker, VMware). The QR window says which
  address it used.
- **The table code** (`k7m2x9qa4fpe`) is random and permanent for that table, so guests can't open another table's
  menu by changing a number in the address.
- **Automatic (default):** the address follows this PC's **Wi-Fi** IPv4 address (the "Wireless LAN adapter Wi-Fi"
  entry in `ipconfig`) and is re-detected while the system runs.
- **Manual:** in **Settings → Table QR codes**, choose **Manual** and type an address (e.g. a fixed IP, or your website
  when hosted online). It's kept exactly as saved and never changed automatically. Settings shows every table's link
  updating as you type.

Reprint the QR codes after updating from an older version (codes like `/table/table-1` no longer work), and whenever
the server PC's address changes.

### 5. Keep the address from changing

Home and office routers can give the server PC a different address after a restart, which breaks bookmarks and QR
codes. In your router's admin page, set a **DHCP reservation** (also called "static lease" or "fixed IP") for the
server PC. The router's admin page is usually at `192.168.1.1` or `192.168.0.1`; the setting is under LAN or DHCP.

### Faster, more stable mode (optional)

`npm run dev` is the development server. For long service days you can serve the optimised build instead:

```bash
npm run build      # once after each update
npm run preview    # serves it on port 4173
```

Devices then open `http://192.168.1.25:4173`. It behaves the same, loads faster, and uses less of the server PC's power.

### Desktop app on another computer

`AFOS.Desktop` connects straight to the database rather than through the web app. On another PC, point its
`config.json` at the server PC. The database listens on port **5433** with the user and password from `.env`:

```json
{ "ConnectionString": "Host=192.168.1.25;Port=5433;Database=afos;Username=afos;Password=<POSTGRES_PASSWORD>" }
```

Allow the port once on the server PC (PowerShell as Administrator):
`New-NetFirewallRule -DisplayName "AFOS database" -Direction Inbound -Protocol TCP -LocalPort 5433 -Action Allow -Profile Private`.
Only open this port on a network you trust, because anyone who knows the password can read the database. The
desktop app covers a subset of the web app; staff & payroll, stock packs and the kitchen bell are web-only.

### Outside the restaurant's network

Devices on mobile data or another Wi-Fi can't reach the server PC directly. Options:
- **Put it online** with a proper host. See [Hosting it online](#hosting-it-online).
- **Private remote access** for the owner: install [Tailscale](https://tailscale.com) (free) on the server PC and your
  phone, then open `http://<server-PC-tailscale-name>:5173`.

Don't forward ports on your router to expose the server PC to the internet.

---

## Set it up on another computer

**To make another computer the server**, for example a new PC or a second branch: follow
[Start the system](#start-the-system-first-time) on it. Nothing is tied to a particular machine.

**To move your data to it:**
1. On the old server, take a backup (see [Backups](#backups--restore)) and copy the `backups/` file **and** the
   `server/uploads/` folder (menu photos) to the new computer.
2. On the new computer, run `npm start` once, then restore the backup and copy `uploads` into `server/uploads/`.
3. Run `npm run up` so any newer database changes are applied on top of the restored data.

Use the same `JWT_SECRET` on the new computer if you want existing sign-ins to keep working; otherwise everyone just
signs in again.

**Developing on a second laptop** (running the API with auto-reload instead of in Docker):

```bash
npm install                 # web dependencies
npm run server:install      # API dependencies (also generates the Prisma client)
npm run db:up               # start only Postgres in Docker
npm run db:migrate          # apply migrations   (safe to re-run)
npm run db:seed             # seed demo data     (safe to re-run, never duplicates)
npm run dev:local           # web app + API with auto-reload, side by side
```

Stop the Docker API first (`docker compose stop api`), because both use port 3001.

---

## Online payments (eSewa & Khalti)

Guests pay from their order page: **Pay online → Pay with eSewa / Khalti**. They are sent to the official eSewa or
Khalti page, log in and pay there (the app never sees their PIN), and come back to their order. The server then asks
eSewa/Khalti directly whether the money arrived before marking the bill paid. After that everything works as it does for
a counter payment: the bill shows **Paid**, POS and Tables treat it as settled, every screen updates instantly, and the
receipt shows the method and transaction reference.

**Where the money goes.** Payments go to the **merchant account** that owns the keys in `.env`. They can't be sent to a
wallet number by typing it in. To receive money in **eSewa 9840040733** and **Khalti 9866028826**, register those
wallets as merchant accounts and put the keys you're given in `.env`. The numbers are also shown to guests on the
payment screen (`ESEWA_ACCOUNT`, `KHALTI_ACCOUNT`).

### Test mode (default, no real money)

- **eSewa** works immediately using eSewa's public sandbox merchant. On eSewa's test page, log in with eSewa ID
  `9806800001` (to `…005`), password `Nepal@123`, and token/OTP `123456`.
- **Khalti** also works immediately using the sandbox merchant from Khalti's developer docs. On Khalti's test page,
  use Khalti ID `9800000000` (to `…005`), MPIN `1111` and OTP `987654`. (Optional: put your own sandbox key from
  [test-admin.khalti.com](https://test-admin.khalti.com) in `KHALTI_SECRET_KEY`.)

### Going live (real money)

1. **eSewa:** apply to eSewa for a merchant (ePay) account linked to 9840040733. They give you a **product
   code** (merchant code) and a **secret key**.
2. **Khalti:** sign up as a merchant at [admin.khalti.com](https://admin.khalti.com) with 9866028826 and complete KYC.
   Copy your **live secret key**.
3. In `.env`:
   ```
   ESEWA_ENV=live
   ESEWA_PRODUCT_CODE=<your eSewa product code>
   ESEWA_SECRET_KEY=<your eSewa secret key>
   KHALTI_ENV=live
   KHALTI_SECRET_KEY=<your Khalti live secret key>
   ```
4. Run `npm run up`. The "Test mode" badge disappears from the payment screen.

Keep these keys private. They stay on the server and are never sent to browsers. If a key contains `$`, write it
as `$$` in `.env`.

**Notes**
- Guests return to the address they ordered from (e.g. `http://192.168.1.25:5173`). When the site is hosted online,
  set `PUBLIC_APP_URL` to its public address.
- If a guest pays but closes the browser before returning, the payment is still picked up the next time the order page
  opens: it re-checks unfinished payments with eSewa/Khalti.
- Khalti doesn't accept payments under Rs. 10.
- The eSewa / Khalti buttons in **POS / Billing** are for recording money the guest sent at the counter (e.g. by
  scanning your wallet QR). They don't open a gateway.

---

## Commands

| Command | What it does |
|---|---|
| `npm start` | Start everything: Docker (database, API, backups) + web app |
| `npm run up` / `npm run down` | Start (and rebuild) / stop the Docker containers. **Run `up` after any server change** |
| `npm run dev` | Web app only, on port 5173, reachable from the network. Forwards `/api` to the API on port 3001 |
| `npm run logs` | Follow the API's logs |
| `npm run build` / `npm run preview` | Build the optimised web app / serve it on port 4173, reachable from the network |
| `npm run dev:local` | Web app + API running locally with auto-reload (needs `npm run db:up`) |
| `npm run lint` | Check web and API code |
| `npm run db:migrate` / `db:seed` / `db:setup` | Apply migrations / seed / both, against `DATABASE_URL` |
| `npm run db:demo` | Add the demo restaurant to an existing database. Safe to re-run |

---

## Configuration

Everything lives in **one `.env` file** in the project folder (template: `.env.example`). It is shared by Docker, the
API, Prisma and the web app. The API checks it on startup and lists anything missing or invalid.

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_DB` | – | default `afos` |
| `POSTGRES_PASSWORD` | ✔ | Kept from the database's first start. Changing it later needs a database password change too |
| `POSTGRES_PORT` | – | port on the server PC, default **5433** (avoids clashing with another Postgres on 5432) |
| `DATABASE_URL` | ✔ | for commands run outside Docker; must contain the same password |
| `JWT_SECRET` | ✔ | at least 16 characters. Changing it signs everyone out |
| `API_PORT` | – | default 3001 |
| `CORS_ORIGINS` | – | only needed when the web app is hosted on a different domain from the API (see hosting) |
| `LOG_LEVEL` | – | `debug` / `info` / `warn` / `error` |
| `SEED_ADMIN_PASSWORD` / `SEED_CASHIER_PASSWORD` / `SEED_CHEF_PASSWORD` | ✔ in production | only used when the account doesn't exist yet |
| `BACKUP_RETENTION_DAYS` | – | default 14 |
| `VITE_API_URL` | – | leave **empty** on a local network. Only set it when hosting the web app separately |
| `ESEWA_ENV` / `KHALTI_ENV` | – | `test` (default, sandbox) or `live` |
| `ESEWA_PRODUCT_CODE` / `ESEWA_SECRET_KEY` | ✔ for live eSewa | empty in test mode = eSewa's public sandbox merchant |
| `KHALTI_SECRET_KEY` | ✔ for Khalti | Khalti is off until it's set |
| `ESEWA_ACCOUNT` / `KHALTI_ACCOUNT` | – | wallet numbers shown to guests (9840040733 / 9866028826) |
| `PUBLIC_APP_URL` | – | where guests return after paying; empty = the address they ordered from |

Only `VITE_*` values are sent to browsers, so never put secrets in them.

---

## Database

**PostgreSQL** through **Prisma**.

Tables: `User` (accounts and staff profiles), `StaffCategory` (departments), `StaffPayment` (payroll), `Restaurant`
(settings, one row), `Category`, `MenuItem`, `RecipeItem`, `Table`, `Order`, `OrderItem`, `PaymentAttempt` (every
eSewa/Khalti checkout and the gateway's answer), `Supplier`, `Purchase`, `PurchaseItem`, `StockItem` (with optional
pack size), `StockMovement` (every stock change and why). The old `Customer` table is kept so existing data isn't lost,
but the app no longer uses it.

- **Migrations** are in `server/prisma/migrations/`. Docker applies them automatically every time the API starts
  (`server/docker-entrypoint.sh`); each runs only once.
- **Seed** (`server/prisma/seed.js`) only creates what's missing: the three starter accounts, restaurant settings, and on
  an empty database the demo menu, stock, suppliers and 8 tables. Your own edits are never overwritten.
- Stock quantities are always stored in the item's base unit (e.g. single pieces), so fractional and loose-unit sales
  deduct exactly.

---

## Live updates

Staff screens keep one open connection to the API (`GET /api/events`, Server-Sent Events). The API pushes:

| Event | Sent to | Effect |
|---|---|---|
| `order.created` | admin, cashier, kitchen | Kitchen bell + popup; dashboard and POS refresh |
| `order.updated` | admin, cashier, kitchen | Status and payment changes appear on every screen |
| `stock.low` | admin, cashier | Low-stock / out-of-stock popup and chime |

If the connection drops, screens fall back to refreshing on a timer (the kitchen every 20 s) and reconnect on their
own. The kitchen still rings for orders it picks up that way. Events come from the single API process; running several
API copies behind a load balancer would need Redis or Postgres `LISTEN/NOTIFY` to share them.

---

## Reliability

| Failure | What happens |
|---|---|
| API starts before Postgres | Docker waits for the database health check, and the API retries the connection for ~4 min |
| Postgres restarts mid-service | Requests return `503`, the connection recovers on its own, the UI shows "Reconnecting" and keeps the last data on screen |
| API crashes | It's logged, and Docker restarts it within seconds |
| Browser loses the API | Reads retry, an offline banner appears, and everything resumes once the API is back |
| Live connection drops | Screens switch to timed refreshes and reconnect automatically |
| A staff member is deactivated | They are signed out on every device within ~15 seconds |
| A page crashes | A "Reload" screen appears instead of a blank page |

**Health check:** `GET /health` → `200 {"status":"ok","db":"up",…}` or `503` if the database is down.
**Logs:** one JSON object per line, via `npm run logs`.

---

## Backups & restore

The `backup` container writes `backups/afos-YYYY-MM-DD_HHMM.sql.gz` on start and then every 24 h, keeping
`BACKUP_RETENTION_DAYS` days. **Copy the `backups/` folder off the server PC regularly** (cloud drive or USB). Menu
photos are in `server/uploads/`; back that up too.

```bash
# Backup right now
docker compose exec -T db pg_dump --clean --if-exists --no-owner -U afos afos > backups/manual.sql

# Restore (replaces current data) — macOS/Linux/Git Bash
gunzip -c backups/afos-2026-10-14_0900.sql.gz | docker compose exec -T db psql -U afos -d afos
```

Windows PowerShell:

```powershell
docker compose cp backups\afos-2026-10-14_0900.sql.gz db:/tmp/restore.sql.gz
docker compose exec db sh -c "gunzip -c /tmp/restore.sql.gz | psql -U afos -d afos"
docker compose restart api        # re-applies newer migrations on top of the restored data
```

For a plain `.sql` file, copy it in the same way and run `psql -U afos -d afos -f /tmp/<file>.sql`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| A page (e.g. **Staff & Payroll**) shows an error after an update | The API is on an old build: `npm run up`, then **Ctrl+Shift+R** in the browser |
| `AFOS API cannot start: invalid configuration` | The message lists what's missing. Fill those values in `.env` |
| `npm run up` says `Set POSTGRES_PASSWORD in .env` | `.env` is missing or incomplete |
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop isn't running. Open it and wait for "Engine running" |
| `port is already allocated` (5433 / 3001) | Another program uses the port. Change `POSTGRES_PORT` / `API_PORT` in `.env` or stop it |
| "We can't reach the server" | `docker compose ps`. If `api` isn't `healthy`, check `npm run logs` |
| **Another device can't open the site** | Same Wi-Fi? Using the PC's Wi-Fi IPv4 address (not `localhost` or `172.x`)? Is `npm run dev` running? Is the network set to **Private** and the firewall rule added ([see above](#2-allow-it-through-the-windows-firewall-once))? |
| **Guests' QR codes don't open** | The phone must be on the restaurant Wi-Fi. If the PC's address changed, or the codes are old `/table/table-1` ones, reprint them from **Tables & QR** |
| QR code shows the wrong address (e.g. `172.x` or `localhost`) | Set **Settings → Table QR codes → Guest ordering address** to the PC's Wi-Fi address (shown by `ipconfig`), then reprint |
| Guest sees "This QR code isn't valid any more" | The table was removed, or the code predates the random table codes. Reprint it from **Tables & QR** |
| **No bell in the kitchen** | Tap the yellow "enable the order bell" bar once after loading; check that the bell button reads "Bell on" and the volume is up |
| No low-stock popup | Popups appear only when an item *crosses* its reorder level, and only for admin and cashier. Check the item's reorder level in **Stock**. The top-bar bell lists everything already low |
| Stock didn't change after a sale | The menu item has no recipe. Add one in **Menu → Edit item** |
| "Use Convert units to change …" when editing stock | Changing the unit of an item with history would misread its quantities. Use **Convert to loose units** |
| Stock shows a negative quantity | More was sold than bought. Record the purchase or make an adjustment |
| **"eSewa/Khalti isn't available yet"** on the payment screen | Khalti needs `KHALTI_SECRET_KEY`; live eSewa needs `ESEWA_PRODUCT_CODE` and `ESEWA_SECRET_KEY`. Set them in `.env`, then `npm run up` |
| Guest paid but the bill still shows unpaid | Ask them to reopen their order page: it re-checks the payment with eSewa/Khalti. `npm run logs` shows the gateway's answer |
| After paying, eSewa/Khalti opens a page that doesn't load | The phone couldn't reach the return address. Guests must be on the restaurant Wi-Fi, or set `PUBLIC_APP_URL` when hosted |
| Staff member can't sign in | Check in **Staff & Payroll** that they're active and not set to "Staff" (payroll-only roles can't sign in) |
| `password authentication failed` after changing `POSTGRES_PASSWORD` | Postgres keeps its first password. Change it back, or (this **deletes all data**) `docker compose down -v` |
| `P3005 The database schema is not empty` | The database was made by hand. Mark the first migrations applied once: `cd server && node scripts/prisma.js migrate resolve --applied 20240101000000_init` (repeat for `…01_menu_autoincrement`, `…02_menu_image`), then `npm run db:migrate` |
| Photos missing after moving computers | Copy `server/uploads/` across |
| Receipt prints the whole page | Use **Print** inside the bill window and set the paper to your receipt width (e.g. 80 mm) |
| Entry script fails with `\r: not found` | Windows line endings: `git rm --cached -r . && git reset --hard` |

---

## Hosting it online

To use AFOS from anywhere, or without keeping a PC on, host the **API + database** on Render or Railway and the
**web app** on Vercel or Netlify.

### API + database (Render example)

1. **New → PostgreSQL** (a paid instance, which includes daily backups). Copy its *Internal Database URL*.
2. **New → Web Service** from this repo: root directory `server`, runtime **Docker**, health check path `/health`.
   Environment:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the internal URL from step 1 |
   | `JWT_SECRET` | long random string |
   | `CORS_ORIGINS` | your web app URL, e.g. `https://afos.vercel.app` |
   | `SEED_ADMIN_PASSWORD`, `SEED_CASHIER_PASSWORD`, `SEED_CHEF_PASSWORD` | strong passwords |
   | `TRUST_PROXY` | `true` |

   Add a **persistent disk** at `/app/uploads` for menu photos.
3. Migrations and the seed run automatically on every deploy. A failed migration stops the deploy and keeps the old
   version running.
4. Run a **single instance**. Live updates (kitchen bell, stock popups) are shared within one API process.

Railway works the same way: Postgres plugin, deploy `server/` with its Dockerfile, the same variables, a volume at
`/app/uploads`, health check `/health`.

### Web app (Vercel or Netlify)

- Build command `npm run build`, output directory `dist`.
- Set `VITE_API_URL=https://<your-api>.onrender.com` **before** building; it is built into the app.
- Deep links (`/pos`, `/kitchen`, `/table/<code>/`) work through `vercel.json` / `public/_redirects`.
- Print table QR codes from the **hosted** site so they point at the public address.

### Single server

`npm run build` puts the web app in `dist/`; the API serves `dist/` automatically when it exists, so one Node process
on a VPS can host everything.

### Checklist when hosted

- [ ] Health check `/health` with auto-restart (default on Render/Railway for Docker services).
- [ ] An [UptimeRobot](https://uptimerobot.com) monitor on `https://<api>/health` alerting your phone.
- [ ] Daily database backups enabled, and checked on day one.
- [ ] **Settings → Guest ordering address** set to the public web address, then QR codes reprinted.
- [ ] Persistent disk at `/app/uploads`.
- [ ] Strong `JWT_SECRET` and seed passwords, stored in a password manager.
- [ ] Monthly: restore the latest backup into a scratch database and check the app works against it.
- [ ] When an alert fires: check the logs (`"level":"error"`/`"fatal"`) → `/health` (`db: down` means look at the
      database, no answer means look at the API) → redeploy the last good version → restore from backup only if data is damaged.
