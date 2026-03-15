-- ターン記録テーブル
create table if not exists public.turns (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  player_id uuid references auth.users not null,
  square_index integer not null check (square_index between 1 and 10),
  chosen_index integer not null check (chosen_index in (0, 1)),
  is_correct boolean not null,
  created_at timestamptz default now()
);

-- RLS 有効化
alter table public.turns enable row level security;

-- 自分が参加するセッションのターンを参照・作成できる
create policy "セッション参加者はターンを参照できる"
  on public.turns for select
  using (
    exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = turns.session_id
      and boards.user_id = auth.uid()
    )
  );

create policy "セッション参加者はターンを作成できる"
  on public.turns for insert
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = turns.session_id
      and boards.user_id = auth.uid()
    )
  );
