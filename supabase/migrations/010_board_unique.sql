-- 1ユーザー1ボードを保証する一意制約を追加
alter table public.boards
  add constraint boards_user_id_unique unique (user_id);
