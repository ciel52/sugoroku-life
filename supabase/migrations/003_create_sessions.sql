-- セッションテーブル（2人のマッチング）
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  board_a_id uuid references public.boards on delete cascade not null,
  board_b_id uuid references public.boards on delete cascade not null,
  status text not null default 'playing' check (status in ('playing', 'finished')),
  created_at timestamptz default now()
);

-- RLS 有効化
alter table public.sessions enable row level security;

-- 既存ポリシーを削除してから再作成
drop policy if exists "自分が参加するセッションを参照できる" on public.sessions;
drop policy if exists "自分のボードでセッションを作成できる" on public.sessions;
drop policy if exists "招待リンクでボード作成者のプロフィールを参照できる" on public.boards;

create policy "自分が参加するセッションを参照できる"
  on public.sessions for select
  using (
    exists (
      select 1 from public.boards
      where (boards.id = sessions.board_a_id or boards.id = sessions.board_b_id)
      and boards.user_id = auth.uid()
    )
  );

create policy "自分のボードでセッションを作成できる"
  on public.sessions for insert
  with check (
    exists (
      select 1 from public.boards
      where boards.id = sessions.board_b_id
      and boards.user_id = auth.uid()
    )
  );

-- 招待元のボード情報を誰でも読めるようにする（招待ページ用）
create policy "招待リンクでボード作成者のプロフィールを参照できる"
  on public.boards for select
  using (status = 'published');
