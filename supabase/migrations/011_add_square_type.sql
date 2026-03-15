-- マス種別と効果カラムを追加
alter table public.squares
  add column square_type text not null default 'branch'
    check (square_type in ('branch', 'effect')),
  add column effect integer check (effect in (1, -1)),
  alter column choice_a drop not null,
  alter column choice_b drop not null,
  alter column answer_index drop not null;
