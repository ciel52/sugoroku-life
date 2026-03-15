-- ボードテーブル
create table if not exists public.boards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null default '私の20年',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- マステーブル
create table if not exists public.squares (
  id uuid default gen_random_uuid() primary key,
  board_id uuid references public.boards on delete cascade not null,
  index integer not null check (index between 1 and 10),
  phase text not null,
  age_range text not null,
  event text not null check (char_length(event) <= 200),
  choice_a text not null check (char_length(choice_a) <= 100),
  choice_b text not null check (char_length(choice_b) <= 100),
  answer_index integer not null check (answer_index in (0, 1)),
  created_at timestamptz default now(),
  unique (board_id, index)
);

-- RLS 有効化
alter table public.boards enable row level security;
alter table public.squares enable row level security;

-- boards ポリシー
create policy "自分のボードを参照できる"
  on public.boards for select
  using (auth.uid() = user_id);

create policy "自分のボードを作成できる"
  on public.boards for insert
  with check (auth.uid() = user_id);

create policy "自分のボードを更新できる"
  on public.boards for update
  using (auth.uid() = user_id);

-- squares ポリシー（自分のボードのマスのみ操作可）
create policy "自分のボードのマスを参照できる"
  on public.squares for select
  using (
    exists (
      select 1 from public.boards
      where boards.id = squares.board_id
      and boards.user_id = auth.uid()
    )
  );

create policy "自分のボードのマスを作成できる"
  on public.squares for insert
  with check (
    exists (
      select 1 from public.boards
      where boards.id = squares.board_id
      and boards.user_id = auth.uid()
    )
  );

create policy "自分のボードのマスを更新できる"
  on public.squares for update
  using (
    exists (
      select 1 from public.boards
      where boards.id = squares.board_id
      and boards.user_id = auth.uid()
    )
  );

create policy "自分のボードのマスを削除できる"
  on public.squares for delete
  using (
    exists (
      select 1 from public.boards
      where boards.id = squares.board_id
      and boards.user_id = auth.uid()
    )
  );
