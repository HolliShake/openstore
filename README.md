# OpenStore

OpenStore is a single-store point-of-sale and inventory app for neighborhood
shops. It combines a public storefront with staff tools for checkout, stock
control, and sales reporting.

## Features

- **Storefront:** Public product catalog with current prices, categories, and
  product images.
- **Point of sale:** Search products or scan barcodes, build a cart, record
  cash or GCash payments, and calculate cash change.
- **Inventory:** Create and update products, manage prices and stock thresholds,
  and review purchase history.
- **Stock-in:** Record restocks and suppliers. Product cost is updated using
  weighted-average costing.
- **Losses and expenses:** Record damaged, expired, missing, or spoiled stock
  and operating expenses.
- **Dashboard and insights:** Review sales, profit, low-stock alerts, product
  performance, and recent activity.
- **Reports:** View and print weekly audit reports, customer price lists, and
  suggested restock lists.
- **Staff accounts:** Admins can manage admin and cashier accounts. Staff can
  update their own full name and password from Profile after verifying their
  current password.
- **Roles:** Admins manage the store. Cashiers can use Dashboard, POS, Reports,
  Insights, and their own Profile.

## Requirements

- [Bun](https://bun.sh/) (used by the project scripts and production start
  command)
- Git

OpenStore uses Prisma with SQLite. No separate database server is required.

## Run locally

Run these commands from the repository root.

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/HolliShake/openstore.git
   cd openstore
   bun install
   ```

2. Create the local data directory and copy the environment template:

   ```sh
   mkdir -p db
   cp .env.example .env
   ```

   Edit `.env` if needed. Replace `NEXTAUTH_SECRET` with a private random
   value, for example the output of `openssl rand -base64 32`.
   `DATABASE_URL` is relative to `prisma/schema.prisma` and points to
   `db/custom.db` in the repository.

3. Generate Prisma Client, create the SQLite schema, and seed the initial admin
   account and store configuration:

   ```sh
   bun run db:generate
   bun run db:push
   bun run seed
   ```

4. Start the development server:

   ```sh
   bun run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

On a new database, the seed creates this admin account:

| Username | Password |
| --- | --- |
| `admin` | `openstore2026` |

Change the default password from the staff **Profile** page before using the
store for real transactions. The seed does not overwrite existing accounts or
store configuration.

To add sample inventory, run `bun run scripts/seed-products.ts`. This is
optional; it adds demo products and can be re-run. Avoid demo seed scripts on a
live store unless you intend to add sample data.

### Local pages

| URL | Description | Access |
| --- | --- | --- |
| `/` | Public storefront | Public |
| `/login` | Staff sign-in | Public |
| `/admin` | Dashboard | Admin and cashier |
| `/admin/pos` | Point of sale | Admin and cashier |
| `/admin/reports` | Printable reports and price lists | Admin and cashier |
| `/admin/insights` | Product and sales insights | Admin and cashier |
| `/admin/profile` | Change full name or password | Signed-in staff |
| `/admin/inventory` | Product management | Admin |
| `/admin/stock-in` | Record restocks | Admin |
| `/admin/losses` | Record inventory losses | Admin |
| `/admin/expenses` | Record operating expenses | Admin |
| `/admin/cashiers` | Manage staff accounts | Admin |
| `/admin/settings` | Store name and branding | Admin |
| `/report` | Printable weekly audit report | Signed-in staff |
| `/price-list` | Printable customer price list | Public |
| `/restock-list` | Suggested grocery/restock list | Signed-in staff |

## Production hosting

OpenStore uses Next.js standalone output and a local SQLite database. Host it
on a server or store computer with a **persistent writable disk**. Serverless
hosting with an ephemeral filesystem is not suitable without first moving the
database and uploaded images to persistent services.

### Prepare the server

Install Bun on the server, clone the repository, and install the locked
dependencies:

```sh
git clone https://github.com/HolliShake/openstore.git
cd openstore
bun install --frozen-lockfile
mkdir -p db public/uploads
cp .env.example .env
```

Edit `.env` for the server. Use an absolute database path, the public HTTPS
URL, and a strong private secret. For example, change the template values to:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | `file:/srv/openstore/db/custom.db` |
| `NEXTAUTH_URL` | `https://store.example.com` |
| `NEXTAUTH_SECRET` | A private random value, e.g. `openssl rand -base64 32` |

Set `NEXTAUTH_URL` to the canonical URL staff will use, including `https://`
when TLS is enabled. Keep `.env` private and do not commit it.

Initialize the database and build the standalone app:

```sh
bun run db:generate
bun run db:push
bun run seed
bun run build
```

`bun run db:push` applies the current Prisma schema and may alter data. Back up
the database before running it on an existing store.

Start the production server:

```sh
NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 bun run start
```

The app listens on the configured port. For public access, place it behind a
reverse proxy such as Nginx or Caddy and configure HTTPS there. Restrict direct
access to the app port to the proxy or trusted network.

### Keep the server running

For ongoing use, run the app with a service manager such as systemd. Example
unit file (update paths, user, and Bun location for your server):

```ini
[Unit]
Description=OpenStore
After=network.target

[Service]
Type=simple
User=openstore
WorkingDirectory=/srv/openstore
EnvironmentFile=/srv/openstore/.env
Environment=NODE_ENV=production
Environment=HOSTNAME=0.0.0.0
Environment=PORT=3000
ExecStart=/home/openstore/.bun/bin/bun run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

The service below reads the production variables from the repository's `.env`
file. Restrict its permissions, then enable the service:

```sh
chmod 600 /srv/openstore/.env
sudo systemctl daemon-reload
sudo systemctl enable --now openstore
sudo systemctl status openstore
```

### Persistent data and backups

Keep both of these paths on persistent storage and include them in backups:

- `db/custom.db` — products, staff accounts, sales, stock history, expenses,
  losses, and store configuration.
- `public/uploads/` — image files uploaded through product management.

Back up the database and uploads together. Before restoring, stop the app and
restore both paths, then restart it. Keep backups private because the database
contains store and transaction data.

For schema updates, back up data first, deploy the new code, then run
`bun run db:generate` and `bun run db:push` as needed before rebuilding and
restarting the service.

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start the development server |
| `bun run build` | Create the production standalone build |
| `bun run start` | Start the production server |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:push` | Apply the Prisma schema to SQLite |
| `bun run seed` | Create the initial admin and store configuration if missing |
| `bun run scripts/seed-products.ts` | Add demo products |
| `bun run scripts/seed-restock-demo.ts` | Add demo restock-list sales data |

## Troubleshooting

- **Prisma cannot open the SQLite database:** Confirm `.env` has a valid
  `DATABASE_URL` and that the parent directory exists and is writable by the
  app user.
- **Sign-in redirects or fails on the hosted site:** Check that
  `NEXTAUTH_URL` exactly matches the public URL and that `NEXTAUTH_SECRET` is
  set consistently between restarts.
- **Port is already in use:** Set a different `PORT`, then update the reverse
  proxy or firewall configuration to match.
- **Uploaded images disappear after deployment:** Ensure `public/uploads/` is
  persisted across deployments and included in backups.
- **A schema update reports data-loss warnings:** Stop and back up the
  database before applying schema changes; review Prisma's output before
  proceeding.
