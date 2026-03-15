"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfileSetupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      nickname: nickname.trim(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setError("保存に失敗しました。もう一度お試しください。");
    } else {
      router.push("/");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🎲</div>
          <h1 className="text-2xl font-bold text-amber-900">プロフィール設定</h1>
          <p className="mt-1 text-sm text-amber-700">
            ゲーム内で表示される名前を設定してください
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                ニックネーム
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                maxLength={20}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="例: たろう"
              />
              <p className="mt-1 text-xs text-gray-400">{nickname.length}/20文字</p>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || nickname.trim().length === 0}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "保存中..." : "はじめる"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
