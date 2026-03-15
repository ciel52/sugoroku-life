"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("確認メールを送信しました。メールを確認してください。");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else {
        router.push(next);
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🎲</div>
          <h1 className="text-2xl font-bold text-amber-900">人生すごろく</h1>
          <p className="mt-1 text-sm text-amber-700">
            他者の人生を体験する共感ゲーム
          </p>
        </div>

        {/* カード */}
        <div className="rounded-2xl bg-white p-8 shadow-md">
          {/* タブ切り替え */}
          <div className="mb-6 flex rounded-xl bg-amber-50 p-1">
            <button
              onClick={() => { setMode("login"); setError(null); setMessage(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-white text-amber-900 shadow-sm"
                  : "text-amber-600 hover:text-amber-900"
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => { setMode("signup"); setError(null); setMessage(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-white text-amber-900 shadow-sm"
                  : "text-amber-600 hover:text-amber-900"
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="6文字以上"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">
                {error}
              </p>
            )}
            {message && (
              <p className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウントを作成"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
