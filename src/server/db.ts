import "server-only";

// Postgres access. Production uses Neon (DATABASE_URL); local development falls
// back to PGlite, an embedded Postgres stored in .data/pglite, so no credentials
// are needed to run the app. Queries are plain parameterized SQL.

type Row = Record<string, unknown>;
type Db = { query: <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]> };

const SCHEMA = /* sql */ `
create table if not exists users (
  address text primary key,
  created_at timestamptz not null default now(),
  server_seed text not null,
  server_seed_hash text not null,
  client_seed text not null,
  nonce integer not null default 0,
  previous_server_seed text,
  total_spent numeric(20,6) not null default 0,
  cashback_balance numeric(20,6) not null default 0,
  cashback_earned numeric(20,6) not null default 0
);

create table if not exists checkouts (
  id text primary key,
  address text not null,
  kind text not null,
  ref text not null,
  quantity integer not null,
  amount numeric(20,6) not null,
  fee numeric(20,6) not null default 0,
  payee text,
  deadline timestamptz not null,
  status text not null default 'pending',
  tx_hash text unique,
  paid_at timestamptz,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists checkouts_address on checkouts(address);

create table if not exists orders (
  id serial primary key,
  address text not null,
  set_id text not null,
  checkout_id text,
  voucher_id integer,
  price numeric(20,6) not null default 0,
  cashback numeric(20,6) not null default 0,
  server_seed_hash text not null,
  client_seed text not null,
  nonce integer not null,
  created_at timestamptz not null default now()
);
create index if not exists orders_address on orders(address);
-- one order per paid pack slot, so concurrent confirmations can't open a pack twice
alter table orders add column if not exists checkout_slot integer;
create unique index if not exists orders_checkout_slot on orders(checkout_id, checkout_slot);

create table if not exists items (
  id text primary key,
  address text not null,
  card_id text not null,
  set_id text not null,
  name text not null,
  number text not null,
  rarity text not null,
  reverse boolean not null default false,
  img text not null,
  value_at_pull numeric(20,6) not null,
  order_id integer,
  slot text,
  hit boolean not null default false,
  source text not null default 'pack',
  status text not null default 'vault',
  sold_for numeric(20,6),
  acquired_at timestamptz not null default now()
);
create index if not exists items_address on items(address);

create table if not exists listings (
  id text primary key,
  item_id text not null,
  seller text not null,
  price numeric(20,6) not null,
  status text not null default 'active',
  buyer text,
  checkout_id text,
  reserved_by text,
  reserved_until timestamptz,
  created_at timestamptz not null default now(),
  sold_at timestamptz
);
create index if not exists listings_status on listings(status);

create table if not exists payouts (
  id serial primary key,
  address text not null,
  kind text not null,
  amount numeric(20,6) not null,
  status text not null default 'pending',
  item_ids text[] not null default '{}',
  tx_hash text,
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists shipments (
  id text primary key,
  address text not null,
  item_ids text[] not null,
  name text not null,
  line1 text not null,
  city text not null,
  postal text not null,
  country text not null,
  status text not null default 'awaiting_payment',
  checkout_id text,
  tracking text,
  created_at timestamptz not null default now()
);

create table if not exists vouchers (
  id serial primary key,
  address text not null,
  set_id text not null,
  source text not null,
  status text not null default 'available',
  used_order_id integer,
  created_at timestamptz not null default now()
);

create table if not exists mission_claims (
  address text not null,
  mission_id text not null,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  primary key (address, mission_id, period_key)
);

create table if not exists card_prices (
  card_id text primary key,
  price numeric(20,6),
  reverse_price numeric(20,6),
  updated_at timestamptz not null default now()
);

create table if not exists pack_prices (
  set_id text primary key,
  market numeric(20,6),
  price numeric(20,6) not null,
  updated_at timestamptz not null default now()
);
`;

const g = globalThis as unknown as { __pcDb?: Promise<Db> };

async function connect(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    return { query: async (text, params = []) => (await sql.query(text, params)) as never };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
  mkdirSync(dir, { recursive: true });
  const pg = new PGlite(dir);
  return { query: async (text, params = []) => (await pg.query(text, params)).rows as never };
}

async function init() {
  const db = await connect();
  // run each statement on its own: Neon's HTTP driver takes one statement per call
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
  return db;
}

export function db() {
  g.__pcDb ??= init().catch((e) => {
    g.__pcDb = undefined;
    throw e;
  });
  return g.__pcDb;
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []) {
  return (await db()).query<T>(text, params);
}

export async function one<T extends Row = Row>(text: string, params: unknown[] = []) {
  return (await q<T>(text, params))[0] as T | undefined;
}

/** numeric columns come back as strings; this reads them as numbers */
export const num = (v: unknown) => (v == null ? 0 : Number(v));
