-- 効果マス訪問記録テーブル
create table if not exists public.effect_visits (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  player_id uuid references auth.users not null,
  square_index integer not null check (square_index between 1 and 10),
  created_at timestamptz default now()
);

-- RLS 有効化
alter table public.effect_visits enable row level security;

create policy "セッション参加者は効果マス訪問を参照できる"
  on public.effect_visits for select
  using (
    exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = effect_visits.session_id
      and boards.user_id = auth.uid()
    )
  );

create policy "セッション参加者は効果マス訪問を記録できる"
  on public.effect_visits for insert
  with check (
    player_id = auth.uid()
    and exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = effect_visits.session_id
      and boards.user_id = auth.uid()
    )
  );
