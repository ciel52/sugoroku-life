-- チャットメッセージテーブル
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  user_id uuid references auth.users not null,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz default now()
);

-- RLS 有効化
alter table public.messages enable row level security;

-- セッション参加者のみ読み書き可能
create policy "セッション参加者はメッセージを参照できる"
  on public.messages for select
  using (
    exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = messages.session_id
      and boards.user_id = auth.uid()
    )
  );

create policy "セッション参加者はメッセージを送信できる"
  on public.messages for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions
      join public.boards on (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      where sessions.id = messages.session_id
      and boards.user_id = auth.uid()
    )
  );

-- Realtimeを有効化
alter publication supabase_realtime add table public.messages;
