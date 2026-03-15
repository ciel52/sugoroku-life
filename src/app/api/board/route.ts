import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SquareInput } from "@/lib/phases";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, squares, birthPlace, birthYear }: {
    title: string;
    squares: SquareInput[];
    birthPlace?: string;
    birthYear?: number | null;
  } = await request.json();

  // 既存ボードを確認
  const { data: existingBoard } = await supabase
    .from("boards")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let boardId: string;

  if (existingBoard) {
    // 既存ボードを更新
    boardId = existingBoard.id;
    await supabase
      .from("boards")
      .update({ title, birth_place: birthPlace ?? null, birth_year: birthYear ?? null, status: "published", updated_at: new Date().toISOString() })
      .eq("id", boardId);

    // 既存マスを削除して再挿入
    await supabase.from("squares").delete().eq("board_id", boardId);
  } else {
    // 新規ボードを作成
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .insert({ user_id: user.id, title, birth_place: birthPlace ?? null, birth_year: birthYear ?? null, status: "published" })
      .select()
      .single();

    if (boardError) {
      return NextResponse.json({ error: boardError.message }, { status: 500 });
    }
    boardId = board.id;
  }

  // マスを一括挿入
  const squareRows = squares.map((s) => ({
    board_id: boardId,
    index: s.index,
    phase: s.phase,
    age_range: s.ageRange,
    event: s.event,
    square_type: s.squareType,
    choice_a: s.squareType === "branch" ? s.choiceA : null,
    choice_b: s.squareType === "branch" ? s.choiceB : null,
    answer_index: s.squareType === "branch" ? s.answerIndex : null,
    effect: s.squareType === "effect" ? s.effect : null,
  }));

  const { error: squaresError } = await supabase
    .from("squares")
    .insert(squareRows);

  if (squaresError) {
    return NextResponse.json({ error: squaresError.message }, { status: 500 });
  }

  return NextResponse.json({ boardId });
}
