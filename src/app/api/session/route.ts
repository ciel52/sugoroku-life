import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { boardAId, boardBId }: { boardAId: string; boardBId: string } =
    await request.json();

  // boardBが自分のボードか確認
  const { data: myBoard } = await supabase
    .from("boards")
    .select("id")
    .eq("id", boardBId)
    .eq("user_id", user.id)
    .single();

  if (!myBoard) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // boardAのオーナー（招待者）を取得 → 最初のターンは招待者（Player A）から
  const { data: boardA } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", boardAId)
    .single();

  // セッション作成
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      board_a_id: boardAId,
      board_b_id: boardBId,
      current_turn_player_id: boardA?.user_id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
