-- ボードに出生情報カラムを追加
alter table public.boards
  add column birth_place text,
  add column birth_year  integer;
