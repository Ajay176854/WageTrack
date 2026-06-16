-- ============================================================
-- WageTrack Database Schema for Supabase
-- Updated with corrections:
--   • flat_amount  → rate_per_piece  (used by bundle_packing & cover_packing)
--   • rate         → piece_rate      (on work log tables, column is numeric)
--   • work_desc    → text field that describes the task; when a worker is
--                    temporarily assigned to another unit, log it here as
--                    e.g. "Work assigned on unit2"
--   • Separate work log & attendance tables per unit (4 each)
-- ============================================================


-- ============================================================
-- 1. WORKERS  (single master table, all units)
-- ============================================================
create table public.workers (
  id                text        primary key,
  emp_id            text        unique not null,
  phone             text,
  name              text        not null,
  unit              text        not null
                                check (unit in ('unit1','unit2','unit3','unit4')),
  category          text        not null
                                check (category in (
                                  'piece_work',
                                  'daily_wages',
                                  'monthly_salary',
                                  'bundle_packing',
                                  'cover_packing'
                                )),
  emoji             text,

  -- monthly-salary workers
  salary            numeric     default 0,
  paid_leaves       numeric     default 0,

  -- daily-wage workers
  daily_wage        numeric     default 0,

  -- bundle_packing / cover_packing workers
  -- (previously called flat_amount – now renamed to rate_per_piece)
  rate_per_piece    numeric     default 0,

  -- overtime rate (all applicable categories)
  ot_rate           numeric     default 0,

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

comment on column public.workers.rate_per_piece is
  'Per-piece rate for bundle_packing and cover_packing workers (was flat_amount in the Excel).';


-- ============================================================
-- 2a. UNIT 1 – WORK LOG
-- ============================================================
create table public.unit1_work_log (
  id                  text        primary key,
  worker_id           text        not null
                                  references public.workers(id) on delete cascade,
  date                date        not null,
  category            text        not null,

  assigned_morning    numeric     default 0,
  assigned_afternoon  numeric     default 0,
  assigned_total      numeric     default 0,

  output              numeric     default 0,
  not_completed       numeric     default 0,

  -- piece_rate: the rate applied to each piece/unit for this entry
  -- (was called "rate" in Excel – renamed for clarity)
  piece_rate          numeric     default 0,

  pieces              numeric     default 0,
  pack_rate           numeric     default 0,
  wage                numeric     default 0,

  -- Free-text work description.
  -- When a worker from another unit is temporarily assigned here, enter:
  -- "Work assigned on unit1" (or whichever unit they came from).
  work_desc           text,

  created_at          timestamptz default now()
);

comment on column public.unit1_work_log.piece_rate is
  'Rate per piece/unit for this log entry (was "rate" column in Excel).';
comment on column public.unit1_work_log.work_desc is
  'Free-text task description. For cross-unit workers write e.g. "Work assigned on unit2".';


-- ============================================================
-- 2b. UNIT 2 – WORK LOG
-- ============================================================
create table public.unit2_work_log (
  id                  text        primary key,
  worker_id           text        not null
                                  references public.workers(id) on delete cascade,
  date                date        not null,
  category            text        not null,

  assigned_morning    numeric     default 0,
  assigned_afternoon  numeric     default 0,
  assigned_total      numeric     default 0,

  output              numeric     default 0,
  not_completed       numeric     default 0,

  piece_rate          numeric     default 0,
  pieces              numeric     default 0,
  pack_rate           numeric     default 0,
  wage                numeric     default 0,

  work_desc           text,

  created_at          timestamptz default now()
);

comment on column public.unit2_work_log.piece_rate is
  'Rate per piece/unit for this log entry (was "rate" column in Excel).';
comment on column public.unit2_work_log.work_desc is
  'Free-text task description. For cross-unit workers write e.g. "Work assigned on unit1".';


-- ============================================================
-- 2c. UNIT 3 – WORK LOG
-- ============================================================
create table public.unit3_work_log (
  id                  text        primary key,
  worker_id           text        not null
                                  references public.workers(id) on delete cascade,
  date                date        not null,
  category            text        not null,

  assigned_morning    numeric     default 0,
  assigned_afternoon  numeric     default 0,
  assigned_total      numeric     default 0,

  output              numeric     default 0,
  not_completed       numeric     default 0,

  piece_rate          numeric     default 0,
  pieces              numeric     default 0,
  pack_rate           numeric     default 0,
  wage                numeric     default 0,

  work_desc           text,

  created_at          timestamptz default now()
);


-- ============================================================
-- 2d. UNIT 4 – WORK LOG
-- ============================================================
create table public.unit4_work_log (
  id                  text        primary key,
  worker_id           text        not null
                                  references public.workers(id) on delete cascade,
  date                date        not null,
  category            text        not null,

  assigned_morning    numeric     default 0,
  assigned_afternoon  numeric     default 0,
  assigned_total      numeric     default 0,

  output              numeric     default 0,
  not_completed       numeric     default 0,

  piece_rate          numeric     default 0,
  pieces              numeric     default 0,
  pack_rate           numeric     default 0,
  wage                numeric     default 0,

  work_desc           text,

  created_at          timestamptz default now()
);


-- ============================================================
-- 3a. UNIT 1 – ATTENDANCE
-- ============================================================
create table public.unit1_attendance (
  id          text        primary key,
  worker_id   text        not null
                          references public.workers(id) on delete cascade,
  date        date        not null,
  status      text        not null
                          check (status in ('present','absent','forenoon')),
  ot_hours    numeric     default 0,
  ot_amount   numeric     default 0,
  advance     numeric     default 0,
  created_at  timestamptz default now(),

  unique (worker_id, date)
);


-- ============================================================
-- 3b. UNIT 2 – ATTENDANCE
-- ============================================================
create table public.unit2_attendance (
  id          text        primary key,
  worker_id   text        not null
                          references public.workers(id) on delete cascade,
  date        date        not null,
  status      text        not null
                          check (status in ('present','absent','forenoon')),
  ot_hours    numeric     default 0,
  ot_amount   numeric     default 0,
  advance     numeric     default 0,
  created_at  timestamptz default now(),

  unique (worker_id, date)
);


-- ============================================================
-- 3c. UNIT 3 – ATTENDANCE
-- ============================================================
create table public.unit3_attendance (
  id          text        primary key,
  worker_id   text        not null
                          references public.workers(id) on delete cascade,
  date        date        not null,
  status      text        not null
                          check (status in ('present','absent','forenoon')),
  ot_hours    numeric     default 0,
  ot_amount   numeric     default 0,
  advance     numeric     default 0,
  created_at  timestamptz default now(),

  unique (worker_id, date)
);


-- ============================================================
-- 3d. UNIT 4 – ATTENDANCE
-- ============================================================
create table public.unit4_attendance (
  id          text        primary key,
  worker_id   text        not null
                          references public.workers(id) on delete cascade,
  date        date        not null,
  status      text        not null
                          check (status in ('present','absent','forenoon')),
  ot_hours    numeric     default 0,
  ot_amount   numeric     default 0,
  advance     numeric     default 0,
  created_at  timestamptz default now(),

  unique (worker_id, date)
);


-- ============================================================
-- 4. MAINTENANCE  (cross-unit / special task log)
-- ============================================================
create table public.maintenance (
  id               text        primary key,
  date             date        not null,
  worker_id        text        references public.workers(id) on delete set null,
  worker_name      text,                   -- denormalised fallback
  home_unit        text,
  home_category    text,
  work_description text,
  wage_amount      numeric     default 0,
  ot_hours         numeric     default 0,
  ot_amount        numeric     default 0,
  advance          numeric     default 0,
  created_at       timestamptz default now()
);


-- ============================================================
-- 5. USERS  (app login + role-based access)
-- ============================================================
create table public.users (
  id            uuid        primary key default gen_random_uuid(),
  auth_id       uuid        unique not null references auth.users(id) on delete cascade,
  username      text        unique not null,
  email         text        unique,
  role          text        not null check (role in ('admin','supervisor')),

  -- JSON access map, e.g.:
  -- { "unit1": ["attendance","work","payment"],
  --   "unit2": ["attendance","work"],
  --   "maintenance": ["maintenance"] }
  access        jsonb       default '{}'::jsonb,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- workers
create index idx_workers_unit      on public.workers(unit);
create index idx_workers_category  on public.workers(category);

-- unit1
create index idx_u1_wl_worker   on public.unit1_work_log(worker_id);
create index idx_u1_wl_date     on public.unit1_work_log(date);
create index idx_u1_att_worker  on public.unit1_attendance(worker_id);
create index idx_u1_att_date    on public.unit1_attendance(date);

-- unit2
create index idx_u2_wl_worker   on public.unit2_work_log(worker_id);
create index idx_u2_wl_date     on public.unit2_work_log(date);
create index idx_u2_att_worker  on public.unit2_attendance(worker_id);
create index idx_u2_att_date    on public.unit2_attendance(date);

-- unit3
create index idx_u3_wl_worker   on public.unit3_work_log(worker_id);
create index idx_u3_wl_date     on public.unit3_work_log(date);
create index idx_u3_att_worker  on public.unit3_attendance(worker_id);
create index idx_u3_att_date    on public.unit3_attendance(date);

-- unit4
create index idx_u4_wl_worker   on public.unit4_work_log(worker_id);
create index idx_u4_wl_date     on public.unit4_work_log(date);
create index idx_u4_att_worker  on public.unit4_attendance(worker_id);
create index idx_u4_att_date    on public.unit4_attendance(date);


-- ============================================================
-- ROW LEVEL SECURITY (enable on all tables)
-- ============================================================
alter table public.workers         enable row level security;
alter table public.unit1_work_log  enable row level security;
alter table public.unit2_work_log  enable row level security;
alter table public.unit3_work_log  enable row level security;
alter table public.unit4_work_log  enable row level security;
alter table public.unit1_attendance enable row level security;
alter table public.unit2_attendance enable row level security;
alter table public.unit3_attendance enable row level security;
alter table public.unit4_attendance enable row level security;
alter table public.maintenance      enable row level security;
alter table public.users            enable row level security;


-- ============================================================
-- AUTO updated_at TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workers_updated_at
  before update on public.workers
  for each row execute function public.handle_updated_at();

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();


-- ============================================================
-- QUICK-REFERENCE NOTES
-- ============================================================
--
-- Column rename summary (Excel  →  Supabase)
-- ------------------------------------------
--   workers.flatAmount          →  workers.rate_per_piece
--       Used by bundle_packing and cover_packing workers.
--       Stores the fixed amount paid per piece packed.
--
--   unitX_entries.rate          →  unitX_work_log.piece_rate
--       The per-piece rate applied on a specific work-log row.
--       Piece-work workers may have varying rates per job/day.
--
-- Cross-unit worker assignment
-- ------------------------------------------
--   When a worker is temporarily sent to do work in a unit
--   that is NOT their home unit, create a row in THAT unit's
--   work_log table (not their home unit's table) and set:
--       work_desc = 'Work assigned on unit<N>'
--   where <N> is the unit they were originally from.
--   This keeps each unit's log self-contained while still
--   making cross-unit assignments searchable via work_desc.
--
-- ============================================================