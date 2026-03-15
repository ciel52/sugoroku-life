import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import Link from "next/link";

// 毎回最新メッセージをDBから取得（結果ページから戻ってきても過去チャットが消えないようにする）
export const dynamic = "force-dynamic";

export default async function ChatPage({
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

  const { data: boardB } = await supabase
    .from("boards")
    .select("user_id")
    .eq("id", session.board_b_id)
    .single();

  const isPlayerA = boardA?.user_id === user.id;

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

  // 既存メッセージを取得
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, user_id, body, created_at, profiles(nickname)")
    .eq("session_id", sessionId)
    .order("created_at");

  const messages = (rawMessages ?? []).map((m) => ({
    ...m,
    profiles: Array.isArray(m.profiles)
      ? m.profiles[0] ?? null
      : (m.profiles as { nickname: string } | null),
  }));

  return (
    <div className="flex h-screen flex-col bg-amber-50">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-amber-100 bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-amber-900">振り返りチャット</h1>
          <p className="text-xs text-gray-500">{opponentNickname} さんと</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/game/${sessionId}/result`}
            className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
          >
            結果を見る
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            ホーム
          </Link>
        </div>
      </div>

      {/* チャット本体 */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel
          sessionId={sessionId}
          myUserId={user.id}
          myNickname={myNickname}
          initialMessages={messages}
        />
      </div>
    </div>
  );
}
