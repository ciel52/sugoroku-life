-- sessions テーブルにターン管理カラムを追加
alter table public.sessions
  add column current_turn_player_id uuid references auth.users(id);

-- UPDATE イベントを Realtime で受信するため REPLICA IDENTITY を変更
alter table public.sessions replica identity full;
