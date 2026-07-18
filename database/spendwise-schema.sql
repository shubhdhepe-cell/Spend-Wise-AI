-- ============================================================
-- SpendWise AI — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES TABLE
-- One row per user, linked 1:1 with Supabase Auth's auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  monthly_budget numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'User profile info, one row per authenticated user.';

-- ------------------------------------------------------------
-- 2. EXPENSES TABLE
-- ------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  category text not null check (
    category in ('Food','Transport','Shopping','Education','Bills','Entertainment','Health','Other')
  ),
  description text,
  expense_date date not null,
  payment_method text, -- e.g. 'cash', 'card', 'upi'
  created_at timestamptz not null default now()
);

comment on table public.expenses is 'Individual expense records logged by users.';

-- Indexes for the queries the dashboard will run constantly
create index if not exists idx_expenses_user_id on public.expenses(user_id);
create index if not exists idx_expenses_user_date on public.expenses(user_id, expense_date);
create index if not exists idx_expenses_user_category on public.expenses(user_id, category);

-- ------------------------------------------------------------
-- 3. AUTO-CREATE PROFILE ON SIGNUP
-- Whenever a new user signs up via Supabase Auth, create their
-- profile row automatically.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      case when new.email is not null then split_part(new.email, '@', 1) else 'Guest' end
    ),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- Users can only ever read/write their own data.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.expenses enable row level security;

-- Profiles: a user can view and update only their own profile
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Expenses: full CRUD, but only on rows the user owns
drop policy if exists "Users can view own expenses" on public.expenses;
create policy "Users can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own expenses" on public.expenses;
create policy "Users can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own expenses" on public.expenses;
create policy "Users can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own expenses" on public.expenses;
create policy "Users can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. HELPER VIEWS (optional but useful for the dashboard)
-- These compute real stats server-side so your frontend/Edge
-- Functions don't have to re-derive them from raw rows.
-- ------------------------------------------------------------

-- Spending grouped by category, per user, for the current month
create or replace view public.v_spending_by_category_this_month as
select
  user_id,
  category,
  sum(amount) as total,
  count(*) as transaction_count
from public.expenses
where date_trunc('month', expense_date) = date_trunc('month', current_date)
group by user_id, category;

-- Daily totals for the last 30 days, per user (for the trend chart)
create or replace view public.v_daily_totals_last_30_days as
select
  user_id,
  expense_date,
  sum(amount) as total
from public.expenses
where expense_date >= current_date - interval '30 days'
group by user_id, expense_date
order by expense_date;

-- Note: views inherit RLS from the underlying "expenses" table automatically,
-- so users will only ever see their own rows through these views too.

-- ============================================================
-- Done. Next steps:
-- 1. Run this file in the Supabase SQL Editor.
-- 2. Confirm "profiles" and "expenses" appear under Table Editor.
-- 3. Enable Email auth under Authentication → Providers (if not already on).
-- 4. Your frontend/Edge Functions can now query these tables —
--    RLS ensures every request is automatically scoped to auth.uid().
-- ============================================================
