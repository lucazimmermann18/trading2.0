-- ================================================================
-- TradeAI — Supabase Schema
-- Ausführen in: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- Settings (immer genau eine Zeile)
create table if not exists settings (
  id              int primary key default 1 check (id = 1),
  skillset        text    not null default 'Smart Money Concepts',
  threshold       int     not null default 82,
  timeframe       text    not null default 'H1',
  scanner_on      bool    not null default true,
  active_provider text    not null default 'anthropic',
  selected_models jsonb   not null default '{}',
  active_pair_ids int[]   not null default array[]::int[],
  updated_at      timestamptz default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- API Keys (server-seitig, nie an den Client zurückgeben)
create table if not exists api_keys (
  provider    text primary key,
  api_key     text        not null,
  model       text        not null,
  updated_at  timestamptz default now()
);

-- Signal History
create table if not exists signal_history (
  id          text primary key,
  sym         text    not null,
  side        text    not null,
  tf          text    not null,
  skillset    text    not null default '',
  entry       float   not null,
  sl          float   not null,
  tp1         float   not null,
  tp2         float   not null,
  digits      int     not null,
  confidence  int,
  rr          text,
  state       text    not null default 'ACTIVE',
  pnl_r       float,
  notes       text,
  why         text,
  confluences jsonb   not null default '[]',
  time        bigint  not null,
  expires_at  bigint,
  created_at  timestamptz default now()
);
create index if not exists signal_history_time_idx on signal_history (time desc);
create index if not exists signal_history_state_idx on signal_history (state);

-- Custom Pairs
create table if not exists custom_pairs (
  id          int primary key,
  sym         text    not null,
  name        text    not null,
  grp         text    not null default 'Custom',
  digits      int     not null,
  spread      float   not null default 1.0,
  active      bool    not null default true,
  created_at  timestamptz default now()
);

-- Trade Lessons (KI-Reviews nach abgeschlossenen Trades)
create table if not exists lessons (
  id          text primary key,
  sym         text    not null,
  side        text    not null,
  outcome     text    not null,
  pnl_r       float,
  lesson      text,
  strengths   jsonb   not null default '[]',
  mistakes    jsonb   not null default '[]',
  next_time   text,
  created_at  timestamptz default now()
);
create index if not exists lessons_sym_idx on lessons (sym, created_at desc);

-- ================================================================
-- Row Level Security deaktivieren (Single-User App, kein Auth nötig)
-- Zugriff nur über Service Role Key (server-seitig)
-- ================================================================
alter table settings       disable row level security;
alter table api_keys       disable row level security;
alter table signal_history disable row level security;
alter table custom_pairs   disable row level security;
alter table lessons        disable row level security;
