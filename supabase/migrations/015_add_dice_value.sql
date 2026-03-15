-- ターン記録にサイコロの目を追加
alter table public.turns
  add column if not exists dice_value integer check (dice_value between 1 and 3);

-- 効果マス訪問記録にサイコロの目を追加
alter table public.effect_visits
  add column if not exists dice_value integer check (dice_value between 1 and 3);
