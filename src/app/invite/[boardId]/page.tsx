import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AcceptInviteButton from "./AcceptInviteButton";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/invite/${boardId}`);

  // 招待元のボードを取得（profilesは別クエリで取得）
  const { data: board } = await supabase
    .from("boards")
    .select("id, title, user_id")
    .eq("id", boardId)
    .eq("status", "published")
    .single();

  if (!board) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50">
        <p className="text-amber-800">招待リンクが無効です。</p>
      </div>
    );
  }

  // 自分自身への招待はNG
  if (board.user_id === user.id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50">
        <div className="text-center">
          <p className="text-amber-800">自分のボードには参加できません。</p>
          <a href="/" className="mt-4 block text-sm text-amber-600 underline">ホームへ戻る</a>
        </div>
      </div>
    );
  }

  // 招待者のニックネームを別途取得
  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", board.user_id)
    .single();

  const inviterNickname = inviterProfile?.nickname ?? "？";

  // 自分のボードが存在するか確認
  const { data: myBoard } = await supabase
    .from("boards")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "published")
    .maybeSingle();

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-6xl">🎲</div>
        <h1 className="text-2xl font-bold text-amber-900">招待が届きました</h1>
        <p className="mt-2 text-amber-700">
          <span className="font-semibold">{inviterNickname}</span> さんがあなたを招待しています
        </p>
        <p className="mt-1 text-sm text-gray-500">「{board.title}」</p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-md">
          {myBoard ? (
            <AcceptInviteButton inviterBoardId={boardId} myBoardId={myBoard.id} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                参加するには、まず自分の人生ボードを作成してください。
              </p>
              <a
                href={`/board/create?invitedBy=${boardId}`}
                className="block w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                自分のボードを作ってゲームに参加する
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
