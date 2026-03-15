import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GameBoard from "./GameBoard";

export default async function GamePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, board_a_id, board_b_id, current_turn_player_id")
    .eq("id", sessionId)
    .single();

  if (!session) redirect("/");

  const { data: boardA } = await supabase
    .from("boards")
    .select("user_id, birth_place, birth_year")
    .eq("id", session.board_a_id)
    .single();

  const { data: boardB } = await supabase
    .from("boards")
    .select("user_id, birth_place, birth_year")
    .eq("id", session.board_b_id)
    .single();

  const isPlayerA = boardA?.user_id === user.id;
  const myBoardId = isPlayerA ? session.board_a_id : session.board_b_id;
  const opponentBoardId = isPlayerA ? session.board_b_id : session.board_a_id;

  // プロフィールを別途取得
  const { data: profileA } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", boardA?.user_id)
    .single();

  const { data: profileB } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", boardB?.user_id)
    .single();

  const myNickname       = (isPlayerA ? profileA : profileB)?.nickname ?? "？";
  const opponentNickname = (isPlayerA ? profileB : profileA)?.nickname ?? "？";

  // 相手のuser_id・出生情報
  const opponentUserId = isPlayerA ? boardB?.user_id : boardA?.user_id;
  const opponentBoard = isPlayerA ? boardB : boardA;
  const opponentBirthPlace = opponentBoard?.birth_place ?? null;
  const opponentBirthYear = opponentBoard?.birth_year ?? null;

  // 相手のボードのマスを取得（自分がプレイする）
  const { data: squares } = await supabase
    .from("squares")
    .select("index, phase, age_range, event, square_type, choice_a, choice_b, answer_index, effect")
    .eq("board_id", opponentBoardId)
    .order("index");

  // 自分のボードのマスを取得（相手が観戦する）
  const { data: mySquares } = await supabase
    .from("squares")
    .select("index, phase, age_range, event, square_type, choice_a, choice_b, answer_index, effect")
    .eq("board_id", myBoardId)
    .order("index");

  const myBoard = isPlayerA ? boardA : boardB;
  const myBirthPlace = myBoard?.birth_place ?? null;
  const myBirthYear = myBoard?.birth_year ?? null;

  // 自分のこれまでのターン
  const { data: myTurns } = await supabase
    .from("turns")
    .select("square_index, chosen_index, is_correct")
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .order("created_at");

  // 相手のこれまでのターン
  const { data: opponentTurns } = opponentUserId
    ? await supabase
        .from("turns")
        .select("square_index, chosen_index, is_correct")
        .eq("session_id", sessionId)
        .eq("player_id", opponentUserId)
        .order("created_at")
    : { data: [] };

  return (
    <GameBoard
      sessionId={sessionId}
      squares={squares ?? []}
      mySquares={mySquares ?? []}
      initialTurns={myTurns ?? []}
      initialOpponentTurns={opponentTurns ?? []}
      opponentNickname={opponentNickname}
      myNickname={myNickname}
      myUserId={user.id}
      opponentUserId={opponentUserId ?? ""}
      opponentBirthPlace={opponentBirthPlace}
      opponentBirthYear={opponentBirthYear}
      myBirthPlace={myBirthPlace}
      myBirthYear={myBirthYear}
      initialCurrentTurnPlayerId={session.current_turn_player_id ?? user.id}
    />
  );
}
