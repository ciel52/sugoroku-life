"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcceptInviteButton({
  inviterBoardId,
  myBoardId,
}: {
  inviterBoardId: string;
  myBoardId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardAId: inviterBoardId,
        boardBId: myBoardId,
      }),
    });

    if (!res.ok) {
      setError("セッションの作成に失敗しました。");
      setLoading(false);
      return;
    }

    const { sessionId } = await res.json();
    router.push(`/game/${sessionId}`);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        あなたのボードは作成済みです。
        <br />
        このまま参加してゲームを始めましょう！
      </p>
      <button
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? "参加中..." : "ゲームに参加する"}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
