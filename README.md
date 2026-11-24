# OpenStore — Neighborhood Store Inventory & Audit System

A single-store inventory, POS, and revenue/loss tracking web app for a neighborhood
grocery (sari-sari) store. Built with **Next.js 16 (App Router) + TypeScript +
Tailwind CSS + shadcn/ui + Prisma 6 (SQLite)**, using **Bun** as the runtime and
package manager.

Features: public storefront, POS checkout with barcode scanning, product
inventory with weighted-average costing, stock-in (restock) history, loss
recording, expenses, admin dashboard with analytics, printable weekly audit
report, customer price list, and a priority-ranked grocery/restock list.

---

## Table of Contents

1. [Requirements](#requirements)
2. [Installation](#installation)
3. [Running Locally (Development)](#running-locally-development)
4. [Building & Hosting Locally (Production)](#building--hosting-locally-production)
5. [Environment Variables](#environment-variables)
6. [Default Admin Account](#default-admin-account)
7. [Useful Scripts](#useful-scripts)
8. [Project Structure](#project-structure)
9. [Troubleshooting](#troubleshooting)

---

## Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| [Bun](https://bun.sh) | 1.x | Runtime + package manager (npm/pnpm also work, see notes) |
| Node.js | 20+ | Only needed if you prefer npm/pnpm over Bun |
| Git | any | To clone the repository |

Everything else (SQLite) needs no separate server — the database is a single
file at `db/custom.db`.

## Installation

```bash
# 1. Clone the repo
git clone <your-repo-url> openstore
cd openstore

# 2. Install dependencies
bun install            # or: npm install

# 3. Create your .env file (see "Environment Variables" below)
cat > .env <<'EOF'
DATABASE_URL="file:../db/custom.db"
NEXTAUTH_SECRET="change-me-to-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"
EOF

# 4. Generate the Prisma client and create the database schema
bun run db:generate     # or: npx prisma generate
bun run db:push         # or: npx prisma db push

# 5. Seed the admin login account + default store config
npm run seed          # or: bun run seed

# 6. (Optional) Seed demo products for a populated storefront
bun run scripts/seed-products.ts
```

> **npm/pnpm users:** replace `bun run` with `npm run` and `bun run scripts/x.ts`
> with `npx tsx scripts/x.ts` (install `tsx` as a dev dependency first).

## Running Locally (Development)

```bash
bun run dev             # starts Next.js dev server on http://localhost:3000
```

Open **http://localhost:3000** in your browser:

- `/` — public storefront
- `/login` — admin sign-in (`admin` / `openstore2026`, see below)
- `/admin` — admin dashboard (Inventory, POS, Stock-in, Losses, Expenses,
  Insights, Reports)
- `/report` — printable weekly audit report (admin only; `week` selects the week)
- `/price-list` — printable customer price list (public)
- `/restock-list` — printable grocery/restock list (admin only)

The dev server hot-reloads on file changes. Database changes to
`prisma/schema.prisma` require `bun run db:push` again.
## Building & Hosting Locally (Production)

The app is configured with `output: "standalone"`, so a production build is a
self-contained server that does not need the full `node_modules` tree.

```bash
# 1. Build the production bundle (also copies static assets + public/ into .next/standalone)
bun run build

# 2. Start the production server on port 3000
bun run start           # runs: NODE_ENV=production bun .next/standalone/server.js
```

Production server listens on **http://localhost:3000** by default. To change
the port or bind to all interfaces (e.g. so other devices on your LAN can
reach it):

```bash
PORT=8080 HOSTNAME=0.0.0.0 NODE_ENV=production bun .next/standalone/server.js
```

### Keeping it running (process manager)

For a store machine that should always serve the app, run it under a process
manager so it survives crashes and reboots.

**With systemd — recommended for a dedicated mini-PC / laptop:**

```bash
# /etc/systemd/system/openstore.service
[Unit]
Description=OpenStore
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/openstore
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=DATABASE_URL=file:/home/youruser/openstore/db/custom.db
Environment=NEXTAUTH_SECRET=change-me
Environment=NEXTAUTH_URL=http://your-lan-ip:3000
ExecStart=/usr/local/bin/bun /home/youruser/openstore/.next/standalone/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now openstore
sudo systemctl status openstore
```

**Quick alternative with pm2:**

```bash
npm i -g pm2
pm2 start "NODE_ENV=production bun .next/standalone/server.js" --name openstore
pm2 save && pm2 startup   # survive reboots
```

### Data & backups

- All data lives in **one file**: `db/custom.db` (SQLite). Back it up by
  copying that file — no database dumps needed.
- Uploaded product images are stored as base64 inside the database, so a copy
  of `db/custom.db` is a complete backup of the store's data.
- Suggested: a daily cron job, e.g.
  `0 2 * * * cp /home/youruser/openstore/db/custom.db /backup/custom-$(date +\%F).db`

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | SQLite path, e.g. `file:../db/custom.db` (relative to `prisma/schema.prisma`) |
| `NEXTAUTH_SECRET` | production | dev fallback (insecure) | Secret used to sign auth session JWTs. **Set a long random string in production** (e.g. `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | production | `http://localhost:3000` | Canonical URL of the app (must match how users reach it, incl. port / proxy) |
| `PORT` | no | `3000` | Server port |
| `HOSTNAME` | no | `localhost` | Bind address (`0.0.0.0` for LAN access) |

> **Vercel deployment:** This project currently stores data in a local SQLite
> file. Vercel's function filesystem is not persistent, so production hosting
> requires migrating Prisma to a persistent external database before deploying.

## Default Admin Account

Seeded by `bun run scripts/seed.ts`:

| | |
| --- | --- |
| Username | `admin` |
| Password | `openstore2026` |

Change the password before real use by re-running the seed against a fresh
database, or update the `User` row directly (bcrypt hash). Keep the credentials
private — the admin account controls products, stock, sales, and reports.

## Useful Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Development server with hot reload (port 3000) |
| `bun run build` | Production build (standalone output) |
| `bun run start` | Start the production server |
| `bun run lint` | ESLint over the codebase |
| `bun run db:generate` | Generate the Prisma client after schema changes |
| `bun run db:push` | Apply `prisma/schema.prisma` to the SQLite database |
| `bun run scripts/seed.ts` (`npm run seed`) | Create the default admin user + default store config (store name "OpenStore") |
| `bun run scripts/seed-products.ts` | Insert demo products (idempotent) |
| `bun run scripts/seed-restock-demo.ts` | Insert demo backdated sales (idempotent, safe to re-run) |

## Project Structure

```
├── prisma/schema.prisma      # Data models (Product, Sale, SaleItem, StockIn, Loss, Expense, User)
├── db/custom.db              # SQLite database (all store data — back this up!)
├── scripts/                  # Seed + maintenance scripts (bun run scripts/<name>.ts)
├── src/
│   ├── app/
│   │   ├── page.tsx          # Public storefront
│   │   ├── admin/            # Admin dashboard route
│   │   ├── login/            # Staff sign-in route
│   │   ├── report/           # Printable weekly report route
│   │   ├── price-list/       # Printable customer price list route
│   │   ├── restock-list/     # Printable grocery list route
│   │   └── api/              # REST API routes (admin-gated where needed)
│   │       ├── auth/         # NextAuth (credentials sign-in)
│   │       ├── products/     # Product CRUD + list
│   │       ├── sales/        # POS checkout
│   │       ├── stock-in/     # Restocks (weighted-average cost)
│   │       ├── losses/       # Spoilage / damage recording
│   │       ├── expenses/     # Non-COGS expenses
│   │       ├── analytics/    # Best-sellers / slow-movers
│   │       ├── dashboard/    # Dashboard aggregates
│   │       ├── reports/weekly/   # Weekly audit report data
│   │       └── restock-list/ # Grocery list ranked by priority
│   ├── components/
│   │   ├── storefront/       # Public storefront
│   │   ├── admin/            # Admin app (login, dashboard, POS, inventory, ...)
│   │   └── reports/          # Printable views (weekly report, price list, restock list)
│   └── lib/                  # db client, auth, api helpers, formatting, constants
└── .env                      # Environment variables (not committed)
```

## Troubleshooting

- **`prisma:command not found` / client not generated** — run
  `bun run db:generate` (do this after cloning and after every schema change).
- **Sign-in redirects back to the login page in production** —
  `NEXTAUTH_URL` doesn't match the actual URL/port/proxy you're using. Fix the
  env var and restart.
- **`EADDRINUSE :3000`** — another process owns port 3000. Start with
  `PORT=3001` instead, or stop the old process.
- **Database locked / changes not appearing** — make sure only one server
  process is running; restart it after `bun run db:push`.
- **Lost admin password** — delete the row from the `User` table
  (`sqlite3 db/custom.db "DELETE FROM User WHERE username='admin';"`) and
  re-run `bun run scripts/seed.ts`.
