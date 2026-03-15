-- 既存のプロフィール参照ポリシーを削除して、全ユーザーが参照できるよう変更
drop policy if exists "自分のプロフィールを参照できる" on public.profiles;

create policy "認証済みユーザーはプロフィールを参照できる"
  on public.profiles for select
  to authenticated
  using (true);
