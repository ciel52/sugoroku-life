-- セッション参加者が相手のマスも読めるようにポリシーを追加
create policy "セッション参加者は相手のマスを参照できる"
  on public.squares for select
  using (
    exists (
      select 1 from public.sessions
      join public.boards as my_board
        on (my_board.id = sessions.board_a_id or my_board.id = sessions.board_b_id)
      where my_board.user_id = auth.uid()
        and (sessions.board_a_id = squares.board_id
          or sessions.board_b_id = squares.board_id)
    )
  );
