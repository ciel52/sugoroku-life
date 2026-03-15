import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BoardCreateForm from "./BoardCreateForm";
import { createEmptySquares, type SquareInput } from "@/lib/phases";

export default async function BoardCreatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 既存ボードとマスを取得
  const { data: existingBoard } = await supabase
    .from("boards")
    .select("id, title, birth_place, birth_year")
    .eq("user_id", user.id)
    .maybeSingle();

  let initialTitle = "私の20年";
  let initialBirthPlace = "";
  let initialBirthYear = "";
  let initialSquares: SquareInput[] = createEmptySquares();

  if (existingBoard) {
    initialTitle = existingBoard.title;
    initialBirthPlace = existingBoard.birth_place ?? "";
    initialBirthYear = existingBoard.birth_year ? String(existingBoard.birth_year) : "";
    const { data: existingSquares } = await supabase
      .from("squares")
      .select("index, phase, age_range, event, square_type, choice_a, choice_b, answer_index, effect")
      .eq("board_id", existingBoard.id)
      .order("index");

    if (existingSquares && existingSquares.length === 10) {
      initialSquares = existingSquares.map((s) => ({
        index: s.index,
        phase: s.phase,
        ageRange: s.age_range,
        event: s.event,
        squareType: (s.square_type ?? "branch") as "branch" | "effect",
        choiceA: s.choice_a ?? "",
        choiceB: s.choice_b ?? "",
        answerIndex: (s.answer_index ?? 0) as 0 | 1,
        effect: (s.effect ?? 1) as 1 | -1,
      }));
    }
  }

  const isEditing = !!existingBoard;

  return (
    <BoardCreateForm
      initialTitle={initialTitle}
      initialSquares={initialSquares}
      initialBirthPlace={initialBirthPlace}
      initialBirthYear={initialBirthYear}
      isEditing={isEditing}
    />
  );
}
