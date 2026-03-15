-- プロフィールテーブル
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nickname text not null check (char_length(nickname) <= 20),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS (Row Level Security) 有効化
alter table public.profiles enable row level security;

-- 自分のプロフィールのみ読み書き可能
create policy "自分のプロフィールを参照できる"
  on public.profiles for select
  using (auth.uid() = id);

create policy "自分のプロフィールを作成できる"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "自分のプロフィールを更新できる"
  on public.profiles for update
  using (auth.uid() = id);
