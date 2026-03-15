import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InviteLinkBox from "./board/[boardId]/complete/InviteLinkBox";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  if (!profile?.nickname) redirect("/profile/setup");

  // 自分のボードを取得
  const { data: myBoard } = await supabase
    .from("boards")
    .select("id, title")
    .eq("user_id", user.id)
    .maybeSingle();

  // 参加中のセッションを取得（最新）
  let latestSession: { id: string; status: string } | null = null;
  if (myBoard) {
    const { data } = await supabase
      .from("sessions")
      .select("id, status")
      .or(`board_a_id.eq.${myBoard.id},board_b_id.eq.${myBoard.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    latestSession = data;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-sm">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="text-5xl">🎲</div>
          <h1 className="mt-2 text-2xl font-bold text-amber-900">人生すごろく</h1>
          <p className="mt-1 text-sm text-amber-700">
            ようこそ、<span className="font-semibold">{profile.nickname}</span> さん
          </p>
        </div>

        <div className="space-y-4">
          {/* ボードなし */}
          {!myBoard && (
            <div className="rounded-2xl bg-white p-5 shadow-sm text-center">
              <p className="mb-4 text-sm text-gray-600">
                まず自分の人生ボードを作成してください
              </p>
              <Link
                href="/board/create"
                className="block w-full rounded-xl bg-amber-500 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                人生ボードを作る
              </Link>
            </div>
          )}

          {/* ボードあり → 招待リンク表示 */}
          {myBoard && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">あなたのボード</p>
                  <p className="text-sm font-semibold text-gray-800">「{myBoard.title}」</p>
                </div>
                <Link
                  href="/board/create"
                  className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  編集する
                </Link>
              </div>
              <p className="mb-3 text-xs text-gray-500">
                このリンクを相手に送ってゲームを始めましょう
              </p>
              <InviteLinkBox boardId={myBoard.id} />
            </div>
          )}

          {/* 進行中・過去のゲーム */}
          {latestSession && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-medium text-gray-500">直近のゲーム</p>
              <div className="space-y-2">
                {latestSession.status === "playing" && (
                  <Link
                    href={`/game/${latestSession.id}`}
                    className="block w-full rounded-xl bg-green-500 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-600"
                  >
                    ゲームを続ける →
                  </Link>
                )}
                <Link
                  href={`/game/${latestSession.id}/result`}
                  className="block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  プレイ結果を見る
                </Link>
                <Link
                  href={`/game/${latestSession.id}/chat`}
                  className="block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  振り返りチャット
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ログアウト */}
        <form action="/auth/signout" method="post" className="mt-8 text-center">
          <button type="submit" className="text-xs text-gray-400 underline hover:text-gray-600">
            ログアウト
          </button>
        </form>
      </div>
    </div>
  );
}
