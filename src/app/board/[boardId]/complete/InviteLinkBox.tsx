"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function InviteLinkBox({ boardId }: { boardId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [inviteUrl, setInviteUrl] = useState(`/invite/${boardId}`);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/invite/${boardId}`);
  }, [boardId]);

  // 新規セッション作成をリアルタイムで監視（既存セッションは無視）
  useEffect(() => {
    const channel = supabase
      .channel(`waiting-${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sessions",
        },
        (payload) => {
          const session = payload.new as { id: string; board_a_id: string; board_b_id: string };
          if (session.board_a_id === boardId || session.board_b_id === boardId) {
            setWaiting(false);
            router.push(`/game/${session.id}`);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [boardId, router, supabase]);

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <span className="flex-1 truncate text-left text-xs text-amber-800">
          {inviteUrl}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
        >
          {copied ? "✓ コピー済み" : "コピー"}
        </button>
      </div>

      {waiting && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 py-3 text-sm text-amber-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          相手の参加を待っています...
        </div>
      )}

      <p className="text-xs text-gray-400">
        相手がリンクから自分のボードを作成すると、自動でゲームが始まります
      </p>
    </div>
  );
}
