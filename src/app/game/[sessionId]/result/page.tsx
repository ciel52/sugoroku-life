import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ResultPage({
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
    .select("board_a_id, board_b_id")
    .eq("id", sessionId)
    .single();

  if (!session) redirect("/");

  const { data: boardA } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", session.board_a_id)
    .single();

  const isPlayerA = boardA?.user_id === user.id;
  const opponentBoardId = isPlayerA ? session.board_b_id : session.board_a_id;

  const { data: turns } = await supabase
    .from("turns")
    .select("square_index, chosen_index, is_correct")
    .eq("session_id", sessionId)
    .eq("player_id", user.id)
    .order("created_at");

  const { data: effectVisits } = await supabase
    .from("effect_visits")
    .select("square_index")
    .eq("session_id", sessionId)
    .eq("player_id", user.id);

  const visitedEffectIndices = new Set((effectVisits ?? []).map((v) => v.square_index));

  const { data: squares } = await supabase
    .from("squares")
    .select("index, phase, age_range, event, square_type, choice_a, choice_b, answer_index, effect")
    .eq("board_id", opponentBoardId)
    .order("index");

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <div className="text-5xl">📋</div>
          <h1 className="mt-2 text-2xl font-bold text-amber-900">プレイ結果</h1>
        </div>

        <div className="space-y-3">
          {(squares ?? []).map((sq) => {
            const isEffect = sq.square_type === "effect";
            const wasEffectVisited = isEffect && visitedEffectIndices.has(sq.index);
            const turn = isEffect ? undefined : (turns ?? []).find((t) => t.square_index === sq.index);
            const wasPlayed = !isEffect && turn !== undefined;

            // 止まったマス=色付き、止まっていないマス=グレー
            const borderColor = wasEffectVisited
              ? "border-orange-400"
              : isEffect
              ? "border-gray-200"
              : wasPlayed
              ? (turn!.is_correct ? "border-green-400" : "border-red-300")
              : "border-gray-200";

            const badgeClass = wasEffectVisited
              ? "bg-orange-100 text-orange-600"
              : isEffect
              ? "bg-gray-100 text-gray-400"
              : wasPlayed
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-400";

            return (
              <div
                key={sq.index}
                className={`rounded-2xl bg-white p-4 shadow-sm border-l-4 ${borderColor}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${badgeClass}`}>
                    {isEffect ? "⚡" : "🔀"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {isEffect ? "" : `${sq.index}マス目`}{sq.age_range ? `・${sq.age_range}` : ""}
                  </span>
                  {wasPlayed && (
                    <span className="ml-auto text-sm">
                      {turn!.is_correct ? "✓" : "✗"}
                    </span>
                  )}
                  {!isEffect && !wasPlayed && (
                    <span className="ml-auto text-xs text-gray-300">スキップ</span>
                  )}
                  {isEffect && !wasEffectVisited && (
                    <span className="ml-auto text-xs text-gray-300">スキップ</span>
                  )}
                </div>
                <p className={`mb-2 text-sm font-medium ${(!wasPlayed && !wasEffectVisited) ? "text-gray-400" : "text-gray-800"}`}>{sq.event}</p>

                {/* 分岐マス：選択肢A/Bを表示 */}
                {!isEffect && (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {[sq.choice_a, sq.choice_b].map((c, i) => (
                      <div
                        key={i}
                        className={`rounded-lg px-2 py-1.5 ${
                          sq.answer_index === i
                            ? "bg-green-50 text-green-700 font-medium"
                            : wasPlayed && turn!.chosen_index === i && !turn!.is_correct
                            ? "bg-red-50 text-red-600"
                            : "bg-gray-50 text-gray-400"
                        }`}
                      >
                        <span className="font-bold mr-1">{i === 0 ? "A" : "B"}</span>
                        {c}
                        {sq.answer_index === i && (
                          <span className="ml-1 text-green-500">✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 効果マス：効果内容を表示 */}
                {isEffect && (
                  <p className={`text-xs font-medium ${
                    !wasEffectVisited
                      ? "text-gray-400"
                      : sq.effect === 1
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}>
                    {sq.effect === 1 ? "⬆ 1マス進む" : "⬇ 1マス戻る"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-3">
          <a
            href={`/game/${sessionId}/chat`}
            className="block w-full rounded-xl bg-amber-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-600"
          >
            振り返りチャットへ →
          </a>
          <a
            href="/"
            className="block w-full rounded-xl border border-amber-300 bg-white py-3 text-center text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
          >
            ホームへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
