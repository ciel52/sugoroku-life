import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InviteLinkBox from "./InviteLinkBox";

export default async function BoardCompletePage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: board } = await supabase
    .from("boards")
    .select("title")
    .eq("id", boardId)
    .eq("user_id", user.id)
    .single();

  if (!board) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 text-6xl">🎉</div>
        <h1 className="text-2xl font-bold text-amber-900">
          ボードが完成しました！
        </h1>
        <p className="mt-2 text-amber-700">「{board.title}」</p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-md">
          <p className="mb-4 text-sm font-medium text-gray-700">
            以下のリンクを相手に共有して、
            <br />
            ゲームを始めましょう
          </p>
          <InviteLinkBox boardId={boardId} />
        </div>
      </div>
    </div>
  );
}
