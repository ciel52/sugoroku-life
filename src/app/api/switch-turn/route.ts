import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// 効果マス確認時にターンを切り替え、effect_visits に訪問を記録する
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, squareIndex } = await request.json();

  const { data: session } = await supabase
    .from("sessions")
    .select("board_a_id, board_b_id")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: boardA } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", session.board_a_id)
    .single();

  const { data: boardB } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", session.board_b_id)
    .single();

  const isPlayerA = boardA?.user_id === user.id;
  const nextTurnPlayerId = isPlayerA ? boardB?.user_id : boardA?.user_id;

  // 効果マス訪問を記録
  if (squareIndex != null) {
    await supabase
      .from("effect_visits")
      .insert({ session_id: sessionId, player_id: user.id, square_index: squareIndex });
  }

  await supabase
    .from("sessions")
    .update({ current_turn_player_id: nextTurnPlayerId })
    .eq("id", sessionId);

  return NextResponse.json({ nextTurnPlayerId });
}
