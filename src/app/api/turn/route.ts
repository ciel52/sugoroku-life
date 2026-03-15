import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, squareIndex, chosenIndex, diceValue } = await request.json();

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
  const opponentBoardId = isPlayerA ? session.board_b_id : session.board_a_id;

  const { data: square } = await supabase
    .from("squares")
    .select("answer_index")
    .eq("board_id", opponentBoardId)
    .eq("index", squareIndex)
    .single();

  if (!square) return NextResponse.json({ error: "Square not found" }, { status: 404 });

  const isCorrect = square.answer_index === chosenIndex;

  const { error } = await supabase.from("turns").insert({
    session_id: sessionId,
    player_id: user.id,
    square_index: squareIndex,
    chosen_index: chosenIndex,
    is_correct: isCorrect,
    dice_value: diceValue != null ? Number(diceValue) : null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ターンを相手に切り替え
  const nextTurnPlayerId = isPlayerA ? boardB?.user_id : boardA?.user_id;
  await supabase
    .from("sessions")
    .update({ current_turn_player_id: nextTurnPlayerId })
    .eq("id", sessionId);

  return NextResponse.json({ isCorrect, answerIndex: square.answer_index, nextTurnPlayerId });
}
