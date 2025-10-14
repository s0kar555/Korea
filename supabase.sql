-- إنشاء جدول المعاملات مع سياسات الأمان (RLS)
create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text check (type in ('income','expense')) not null,
  amount numeric not null,
  currency text check (currency in ('SAR','KRW','USD')) not null,
  category text,
  note text,
  date date not null default current_date,
  updated_at timestamptz default now()
);

alter table public.transactions enable row level security;

-- قراءة/كتابة المستخدم لبياناته فقط
create policy "select own" on public.transactions
  for select using (auth.uid() = user_id);

create policy "insert own" on public.transactions
  for insert with check (auth.uid() = user_id);

create policy "update own" on public.transactions
  for update using (auth.uid() = user_id);

create policy "delete own" on public.transactions
  for delete using (auth.uid() = user_id);
