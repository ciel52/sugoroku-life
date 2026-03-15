"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { nickname: string } | null;
};

export default function ChatPanel({
  sessionId,
  myUserId,
  myNickname,
  initialMessages,
}: {
  sessionId: string;
  myUserId: string;
  myNickname: string;
  initialMessages: Message[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 親から渡された initialMessages が変わったら同期（結果ページから戻ってきたとき等）
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Supabase Realtimeでメッセージを購読
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const msg = payload.new as Message;
          // 自分のメッセージは楽観的更新済みなのでスキップ
          if (msg.user_id === myUserId) return;

          // ニックネームを取得して追加
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname")
            .eq("id", msg.user_id)
            .single();

          const nickname = profile?.nickname ?? "相手";
          setToastMessage(`${nickname}からメッセージが届きました`);
          setMessages((prev) => [
            ...prev,
            { ...msg, profiles: profile },
          ]);

          // タブが非表示ならブラウザ通知
          if (typeof window !== "undefined" && document.hidden && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(`${nickname}からメッセージ`, {
                body: msg.body.slice(0, 50) + (msg.body.length > 50 ? "…" : ""),
                icon: "/favicon.ico",
              });
            } else if (Notification.permission === "default") {
              Notification.requestPermission().then((p) => {
                if (p === "granted") {
                  new Notification(`${nickname}からメッセージ`, {
                    body: msg.body.slice(0, 50) + (msg.body.length > 50 ? "…" : ""),
                    icon: "/favicon.ico",
                  });
                }
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId, myUserId, supabase]);

  // 新しいメッセージが来たらチャット内のみ最下部にスクロール（ページ全体は動かさない）
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // トーストを2.5秒後に消す
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);

    // 楽観的にUIに追加
    const optimistic: Message = {
      id: crypto.randomUUID(),
      user_id: myUserId,
      body: input.trim(),
      created_at: new Date().toISOString(),
      profiles: { nickname: myNickname },
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    await fetch("/api/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, body: optimistic.body }),
    });

    setSending(false);
  }

  return (
    <div className="flex h-full flex-col relative">
      {/* 受信トースト */}
      {toastMessage && (
        <div
          role="alert"
          className="fixed top-2 left-2 right-2 z-50 rounded-xl bg-amber-500 text-white px-4 py-2 text-sm font-medium shadow-lg"
        >
          {toastMessage}
        </div>
      )}
      {/* メッセージ一覧 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-3 p-4"
      >
        {messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">
            まだメッセージはありません。
            <br />
            気になったマスについて聞いてみましょう！
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === myUserId;
          const nickname = isMe
            ? myNickname
            : msg.profiles?.nickname ?? "相手";
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <span className="text-xs text-gray-400">{nickname}</span>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? "bg-amber-500 text-white rounded-tr-sm"
                    : "bg-white text-gray-800 shadow-sm rounded-tl-sm"
                }`}
              >
                {msg.body}
              </div>
            </div>
          );
        })}
      </div>

      {/* 入力欄 */}
      <form
        onSubmit={handleSend}
        className="border-t border-gray-100 bg-white p-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="メッセージを入力..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
        >
          送信
        </button>
      </form>
    </div>
  );
}
