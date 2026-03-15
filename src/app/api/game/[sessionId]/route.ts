import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // セッション取得
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, board_a_id, board_b_id")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 自分がどちらのプレイヤーか判定
  const { data: boardA } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", session.board_a_id)
    .single();

  const isPlayerA = boardA?.user_id === user.id;
  // 自分がプレイする相手のボードID
  const opponentBoardId = isPlayerA ? session.board_b_id : session.board_a_id;

  // 相手のボードのマスを取得（answerIndexは取得するが表示しない）
  const { data: squares } = await supabase
    .from("squares")
    .select("index, phase, age_range, event, square_type, choice_a, choice_b, answer_index, effect")
    .eq("board_id", opponentBoardId)
    .order("index");

  // これまでのターン記録を取得
  const { data: turns } = await supabase
    .from("turns")
    .select("square_index, chosen_index, is_correct")
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .order("created_at");

  return NextResponse.json({ session, squares, turns, isPlayerA });
}
