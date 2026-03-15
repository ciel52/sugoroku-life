"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import ChatPanel from "@/components/ChatPanel";

type Square = {
  index: number;
  phase: string;
  age_range: string;
  event: string;
  square_type: "branch" | "effect";
  choice_a: string | null;
  choice_b: string | null;
  answer_index: number | null;
  effect: number | null;
};

type Turn = {
  square_index: number;
  chosen_index: number;
  is_correct: boolean;
};

// 相手の現在のアクション（Presence で共有）
type OpponentPresence = {
  playerId: string;
  action: "idle" | "rolling" | "landed" | "choosing" | "effect_viewing" | "revealed";
  diceValue?: number;
  targetSquareIndex?: number;
  currentSquare?: {
    index: number;
    event: string;
    square_type: "branch" | "effect";
    choice_a?: string | null;
    choice_b?: string | null;
    effect?: number | null;
  };
  chosenIndex?: number;
  isCorrect?: boolean;
  answerIndex?: number;
  // ターン終了時に次のターンプレイヤーを通知する
  nextTurnPlayerId?: string;
};

type GamePhase = "idle" | "rolling" | "choosing" | "revealed" | "effect" | "finished";

const DICE_FACES = ["", "⚀", "⚁", "⚂"];

export default function GameBoard({
  sessionId,
  squares,
  initialTurns,
  initialOpponentTurns,
  opponentNickname,
  myNickname,
  myUserId,
  opponentUserId,
  opponentBirthPlace,
  opponentBirthYear,
  initialCurrentTurnPlayerId,
}: {
  sessionId: string;
  squares: Square[];
  initialTurns: Turn[];
  initialOpponentTurns: Turn[];
  opponentNickname: string;
  myNickname: string;
  myUserId: string;
  opponentUserId: string;
  opponentBirthPlace: string | null;
  opponentBirthYear: number | null;
  initialCurrentTurnPlayerId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  // 相手の前回アクションを追跡（idle復帰でターン切り替えを検出するため）
  const prevOpponentActionRef = useRef<string | null>(null);

  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [opponentTurns, setOpponentTurns] = useState<Turn[]>(initialOpponentTurns);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState(initialCurrentTurnPlayerId);
  const [opponentPresence, setOpponentPresence] = useState<OpponentPresence | null>(null);

  const [position, setPosition] = useState<number>(() => {
    if (initialTurns.length === 0) return 1;
    const maxPlayed = Math.max(...initialTurns.map((t) => t.square_index));
    return maxPlayed + 1;
  });
  const [skippedIndices, setSkippedIndices] = useState<Set<number>>(new Set());
  const [currentSquareIndex, setCurrentSquareIndex] = useState<number | null>(null);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [choiceResult, setChoiceResult] = useState<{ isCorrect: boolean; answerIndex: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const isMyTurn = currentTurnPlayerId === myUserId;

  // Supabase チャンネルのセットアップ（Realtime + Presence）
  useEffect(() => {
    const channel = supabase.channel(`session-${sessionId}`, {
      config: { presence: { key: myUserId } },
    });
    channelRef.current = channel;

    channel
      // 相手のターン完了（turns INSERT）
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "turns", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const newTurn = payload.new as {
            square_index: number;
            chosen_index: number;
            is_correct: boolean;
            player_id: string;
          };
          if (newTurn.player_id !== myUserId) {
            setOpponentTurns((prev) => {
              if (prev.some((t) => t.square_index === newTurn.square_index)) return prev;
              return [...prev, {
                square_index: newTurn.square_index,
                chosen_index: newTurn.chosen_index,
                is_correct: newTurn.is_correct,
              }];
            });
          }
        }
      )
      // ターン切り替え（sessions UPDATE）
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as { current_turn_player_id: string };
          if (updated.current_turn_player_id) {
            setCurrentTurnPlayerId(updated.current_turn_player_id);
          }
        }
      )
      // 相手のライブアクション（Presence）
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OpponentPresence>();
        const others = Object.entries(state)
          .flatMap(([, presences]) => presences)
          .find((p) => p.playerId !== myUserId);

        const prevAction = prevOpponentActionRef.current;
        prevOpponentActionRef.current = others?.action ?? null;
        setOpponentPresence(others ?? null);

        // 相手がidle以外→idleに戻ったらターン切り替え（prevActionがnullの場合は初期接続なのでスキップ）
        if (
          others?.action === "idle" &&
          prevAction !== null &&
          prevAction !== "idle"
        ) {
          setCurrentTurnPlayerId(myUserId);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ playerId: myUserId, action: "idle" });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, myUserId, supabase]);

  // Presence を更新するヘルパー
  function trackAction(data: Omit<OpponentPresence, "playerId">) {
    channelRef.current?.track({ playerId: myUserId, ...data });
  }

  const score = turns.filter((t) => t.is_correct).length;
  const opponentScore = opponentTurns.filter((t) => t.is_correct).length;
  const isFinished = position > 10 || phase === "finished";

  function getSquareAt(idx: number): Square | undefined {
    return squares.find((s) => s.index === idx);
  }

  function rollDice() {
    if (!isMyTurn || phase !== "idle" || position > 10) return;

    setPhase("rolling");
    setDiceValue(null);
    trackAction({ action: "rolling" });

    let count = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.ceil(Math.random() * 3));
      count++;
      if (count >= 8) {
        clearInterval(interval);
        const final = Math.ceil(Math.random() * 3);
        setDiceValue(final);

        setTimeout(() => {
          const rawTarget = position + (final - 1);
          const targetIndex = Math.min(rawTarget, 10);

          if (targetIndex > position) {
            setSkippedIndices((prev) => {
              const next = new Set(prev);
              for (let i = position; i < targetIndex; i++) next.add(i);
              return next;
            });
          }

          const sq = getSquareAt(targetIndex);
          setCurrentSquareIndex(targetIndex);

          trackAction({ action: "landed", diceValue: final, targetSquareIndex: targetIndex, currentSquare: sq ? {
            index: sq.index, event: sq.event, square_type: sq.square_type,
            choice_a: sq.choice_a, choice_b: sq.choice_b, effect: sq.effect,
          } : undefined });

          if (sq?.square_type === "effect") {
            setPhase("effect");
            trackAction({ action: "effect_viewing", currentSquare: sq ? {
              index: sq.index, event: sq.event, square_type: sq.square_type, effect: sq.effect,
            } : undefined });
          } else {
            setPhase("choosing");
            trackAction({ action: "choosing", currentSquare: sq ? {
              index: sq.index, event: sq.event, square_type: sq.square_type,
              choice_a: sq.choice_a, choice_b: sq.choice_b,
            } : undefined });
          }
        }, 600);
      }
    }, 80);
  }

  async function handleChoice(chosenIndex: 0 | 1) {
    if (!isMyTurn || phase !== "choosing" || currentSquareIndex === null || loading) return;
    setLoading(true);

    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, squareIndex: currentSquareIndex, chosenIndex }),
    });

    const data = await res.json();
    setChoiceResult({ isCorrect: data.isCorrect, answerIndex: data.answerIndex });
    setTurns((prev) => [
      ...prev,
      { square_index: currentSquareIndex, chosen_index: chosenIndex, is_correct: data.isCorrect },
    ]);
    setPhase("revealed");
    trackAction({
      action: "revealed",
      chosenIndex,
      isCorrect: data.isCorrect,
      answerIndex: data.answerIndex,
      currentSquare: getSquareAt(currentSquareIndex) ? {
        index: currentSquareIndex,
        event: getSquareAt(currentSquareIndex)!.event,
        square_type: "branch",
        choice_a: getSquareAt(currentSquareIndex)!.choice_a,
        choice_b: getSquareAt(currentSquareIndex)!.choice_b,
      } : undefined,
    });
    setLoading(false);
  }

  async function handleEffectConfirm() {
    if (!isMyTurn || currentSquareIndex === null) return;
    const sq = getSquareAt(currentSquareIndex);
    if (!sq || sq.square_type !== "effect") return;

    const effectValue = sq.effect ?? 1;
    if (effectValue === 1) {
      // 効果マスKの次のマス(K+1)をスキップしてK+2へ
      const skipIndex = currentSquareIndex + 1;
      setSkippedIndices((prev) => new Set(prev).add(skipIndex));
      setPosition(Math.min(currentSquareIndex + 2, 11));
    } else {
      // 効果マスKから1つ戻る → K-1に移動（次ターンはKから再スタート）
      setPosition(currentSquareIndex);
    }

    // DBのターン切り替えと効果マス訪問記録をバックグラウンドで実行
    fetch("/api/switch-turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, squareIndex: currentSquareIndex }),
    }).catch(() => {});

    // 自分のターン終了をPresenceで通知 → 相手側はこれを受け取ってターン切り替え
    trackAction({ action: "idle", nextTurnPlayerId: opponentUserId });
    // 自分側も即時切り替え
    setCurrentTurnPlayerId(opponentUserId);

    setPhase("idle");
    setCurrentSquareIndex(null);
    setDiceValue(null);
  }

  function handleNext() {
    const nextPosition = currentSquareIndex! + 1;

    // 自分のターン終了をPresenceで通知 → 相手側はこれを受け取ってターン切り替え
    trackAction({ action: "idle", nextTurnPlayerId: opponentUserId });
    // 自分側も即時切り替え
    setCurrentTurnPlayerId(opponentUserId);

    if (nextPosition > 10) {
      setPhase("finished");
    } else {
      setPosition(nextPosition);
      setPhase("idle");
      setCurrentSquareIndex(null);
      setChoiceResult(null);
      setDiceValue(null);
    }
  }

  const currentSquare = currentSquareIndex !== null
    ? squares.find((s) => s.index === currentSquareIndex)
    : null;

  const nextSquare = getSquareAt(position);

  // ゲーム終了画面
  if (isFinished) {
    const branchSquaresTotal = squares.filter((s) => s.square_type === "branch").length;
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 text-7xl">🎊</div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">COMPLETE!</h1>
          <p className="mt-2 text-gray-500">{opponentNickname} さんの人生をプレイしました</p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-6 shadow-md">
            <p className="mt-4 text-sm text-gray-500">
              {score >= Math.ceil(branchSquaresTotal * 0.8)
                ? "驚くほど共感できました！"
                : score >= Math.ceil(branchSquaresTotal * 0.5)
                ? "半分以上、相手の気持ちに寄り添えました"
                : "価値観の違いがよく出ました。チャットで話してみましょう"}
            </p>
          </div>
          <button
            onClick={() => router.push(`/game/${sessionId}/result`)}
            className="mt-6 w-full rounded-xl bg-amber-500 py-4 text-base font-black text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-400 active:scale-95"
          >
            振り返りへ →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-6">
      <div className="mx-auto max-w-lg space-y-3">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">NOW PLAYING</p>
            <h1 className="text-lg font-black text-gray-900">
              {opponentNickname} <span className="font-normal text-gray-400">の人生</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-500 shadow-sm transition hover:border-amber-300 hover:text-amber-600"
            >
              💬
            </button>
            <a href="/" className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-500 shadow-sm transition hover:border-amber-300 hover:text-amber-600">
              🏠
            </a>
          </div>
        </div>

        {/* ターン表示バッジ */}
        <div className={`rounded-xl px-4 py-3 text-center text-sm font-black tracking-wide transition-all ${
          isMyTurn
            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
            : "border border-gray-200 bg-white text-gray-500 shadow-sm"
        }`}>
          {isMyTurn ? "🎲 YOUR TURN" : `👀 ${opponentNickname} のターン中...`}
        </div>

        {/* ゲーム中チャット（折りたたみ） */}
        {chatOpen && (
          <div className="h-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <ChatPanel sessionId={sessionId} myUserId={myUserId} myNickname={myNickname} initialMessages={[]} />
          </div>
        )}

        {/* 相手の進捗バー */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
            {opponentNickname} の進捗
          </p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => {
              const idx = i + 1;
              const sq = squares.find((s) => s.index === idx);
              const t = opponentTurns.find((t) => t.square_index === idx);
              const isEffect = sq?.square_type === "effect";
              return (
                <div key={idx} className={`flex-1 rounded py-1.5 text-center text-[10px] font-black transition-all ${
                  isEffect ? "bg-amber-100 text-amber-500"
                  : t ? (t.is_correct ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500")
                  : "bg-gray-100 text-gray-400"
                }`}>
                  {isEffect ? "⚡" : t ? (t.is_correct ? "✓" : "✗") : "🔀"}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-right text-[10px] text-gray-400">{opponentScore} / {opponentTurns.length} 共感</p>
        </div>

        {/* すごろくボード */}
        <div>
          {/* スタート */}
          <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-black text-white">S</div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">START</p>
              <p className="text-xs text-amber-700">
                {opponentBirthYear || opponentBirthPlace
                  ? [opponentBirthYear ? `${opponentBirthYear}年` : null, opponentBirthPlace || null].filter(Boolean).join(" · ")
                  : "誕生"}
              </p>
            </div>
          </div>

          {squares.map((sq) => {
            const turn = turns.find((t) => t.square_index === sq.index);
            const isCurrent = currentSquareIndex === sq.index;
            const isStandingHere = isCurrent || (currentSquareIndex === null && sq.index === position - 1);
            const isEffect = sq.square_type === "effect";

            // 矢印の色
            let arrowColor: string;
            if (isCurrent) arrowColor = "text-amber-500";
            else if (turn) arrowColor = turn.is_correct ? "text-emerald-400" : "text-rose-400";
            else arrowColor = "text-amber-300";

            // マス背景
            let rowClass = "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ";
            if (isCurrent) {
              rowClass += "bg-amber-500 shadow-md";
            } else if (turn) {
              rowClass += turn.is_correct
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-rose-50 border border-rose-200";
            } else {
              rowClass += "border border-gray-100 bg-white shadow-sm";
            }

            // バッジ
            let badgeClass = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black ";
            if (isCurrent) badgeClass += "bg-white text-amber-500";
            else if (isEffect) badgeClass += "bg-amber-100 text-amber-500";
            else if (turn) badgeClass += turn.is_correct ? "bg-emerald-200 text-emerald-700" : "bg-rose-200 text-rose-600";
            else badgeClass += "bg-amber-100 text-amber-600";

            // バッジ内容
            let badgeContent: string;
            if (isEffect) badgeContent = "⚡";
            else if (turn) badgeContent = turn.is_correct ? "✓" : "✗";
            else badgeContent = "🔀";

            return (
              <div key={sq.index}>
                <div className="flex flex-col items-center my-0.5">
                  <div className="h-3 w-px bg-amber-300" />
                  <svg width="9" height="6" viewBox="0 0 9 6" className={`${arrowColor} transition-colors`} fill="currentColor">
                    <polygon points="0,0 9,0 4.5,6" />
                  </svg>
                </div>
                <div className={rowClass}>
                  <div className={badgeClass}>{badgeContent}</div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold ${isCurrent ? "text-amber-100" : "text-gray-400"}`}>
                      {sq.index}マス目・{sq.phase}・{sq.age_range}
                      {isEffect && (
                        <span className={`ml-1 ${isCurrent ? "text-amber-200" : "text-gray-500"}`}>
                          {sq.effect === 1 ? "・1マス進む" : "・1マス戻る"}
                        </span>
                      )}
                    </p>
                    <p className={`mt-0.5 text-sm leading-snug ${isCurrent ? "font-semibold text-white" : "text-gray-800"}`}>
                      {sq.event}
                    </p>
                  </div>
                  {isStandingHere && (
                    <span className="shrink-0 animate-bounce text-xl">👣</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* GOAL前コネクター */}
          <div className="flex flex-col items-center my-0.5">
            <div className={`h-3 w-px ${position > 10 ? "bg-amber-400" : "bg-amber-300"}`} />
            <svg width="9" height="6" viewBox="0 0 9 6" className={`transition-colors ${position > 10 ? "text-amber-500" : "text-amber-300"}`} fill="currentColor">
              <polygon points="0,0 9,0 4.5,6" />
            </svg>
          </div>

          {/* ゴール */}
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
            position > 10
              ? "border-amber-400 bg-amber-100 shadow-md"
              : "border-gray-200 bg-white shadow-sm"
          }`}>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
              position > 10 ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-400"
            }`}>G</div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${position > 10 ? "text-amber-600" : "text-gray-400"}`}>GOAL</p>
              <p className={`text-xs ${position > 10 ? "text-amber-700" : "text-gray-300"}`}>
                {position > 10 ? "🎊 20歳 / クリア！" : "20歳"}
              </p>
            </div>
          </div>
        </div>

        {/* ======== アクションエリア ======== */}

        {/* 自分のターン：サイコロ */}
        {isMyTurn && phase === "idle" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">
              現在地：マス {position - 1 <= 0 ? "START" : position - 1}
            </p>
            <button
              onClick={rollDice}
              className="mt-3 w-full rounded-xl bg-amber-500 py-5 text-xl font-black text-white shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 active:scale-95"
            >
              🎲 ROLL DICE
            </button>
            <p className="mt-2 text-[10px] text-gray-400">サイコロ（1〜3）の目だけ進む</p>
          </div>
        )}

        {/* 自分のターン：サイコロアニメーション */}
        {isMyTurn && phase === "rolling" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="text-8xl">{diceValue ? DICE_FACES[diceValue] : "🎲"}</div>
            <p className="mt-3 text-sm font-bold text-amber-500 animate-pulse">ROLLING...</p>
          </div>
        )}

        {/* 自分のターン：効果マス */}
        {isMyTurn && phase === "effect" && currentSquare && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-600">⚡ 効果マス {currentSquare.index}</span>
              <span className="text-xs text-gray-400">{currentSquare.phase}・{currentSquare.age_range}</span>
            </div>
            <p className="my-4 text-sm font-medium leading-relaxed text-gray-800">{currentSquare.event}</p>
            <div className={`rounded-xl border p-4 text-center ${
              currentSquare.effect === 1
                ? "border-emerald-200 bg-emerald-50"
                : "border-rose-200 bg-rose-50"
            }`}>
              <p className={`text-2xl font-black ${currentSquare.effect === 1 ? "text-emerald-600" : "text-rose-600"}`}>
                {currentSquare.effect === 1 ? "⬆ 1マス進む！" : "⬇ 1マス戻る"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {currentSquare.effect === 1 ? "次のマスをスキップして進みます" : "1つ前のマスから再スタート"}
              </p>
            </div>
            <button
              onClick={handleEffectConfirm}
              className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
            >
              確認して進む →
            </button>
          </div>
        )}

        {/* 自分のターン：分岐マス（選択・結果） */}
        {isMyTurn && (phase === "choosing" || phase === "revealed") && currentSquare && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-600">🔀 分岐マス {currentSquare.index}</span>
              <span className="text-xs text-gray-400">{currentSquare.phase}・{currentSquare.age_range}</span>
            </div>
            <p className="my-4 text-sm font-medium leading-relaxed text-gray-800">{currentSquare.event}</p>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
              {phase === "choosing" ? `${opponentNickname} の選択は？` : "ANSWER"}
            </p>
            <div className="space-y-2">
              {([currentSquare.choice_a, currentSquare.choice_b] as const).map((choice, idx) => {
                const isAnswer = currentSquare.answer_index === idx;
                const isChosen = phase === "revealed" && turns[turns.length - 1]?.chosen_index === idx;
                let btnClass = "w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all";
                if (phase === "revealed") {
                  if (isAnswer) btnClass += " border-emerald-400 bg-emerald-50 text-emerald-800";
                  else if (isChosen && !isAnswer) btnClass += " border-rose-400 bg-rose-50 text-rose-700";
                  else btnClass += " border-gray-100 bg-gray-50 text-gray-400";
                } else {
                  btnClass += " border-gray-200 bg-white text-gray-700 hover:border-amber-400 hover:bg-amber-50";
                }
                return (
                  <button
                    key={idx}
                    onClick={() => phase === "choosing" ? handleChoice(idx as 0 | 1) : undefined}
                    disabled={phase === "revealed" || loading}
                    className={btnClass}
                  >
                    <span className="mr-2 font-black text-amber-500">{idx === 0 ? "A" : "B"}</span>
                    {choice}
                    {phase === "revealed" && isAnswer && <span className="ml-2 text-emerald-600">← 正解</span>}
                  </button>
                );
              })}
            </div>
            {phase === "revealed" && choiceResult && (
              <div className={`mt-4 rounded-xl border p-3 text-center text-sm font-black ${
                choiceResult.isCorrect
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-rose-300 bg-rose-50 text-rose-700"
              }`}>
                {choiceResult.isCorrect ? "✓ 共感！同じ選択でした" : "✗ 違う選択でした"}
              </div>
            )}
            {phase === "revealed" && (
              <button
                onClick={handleNext}
                className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
              >
                {currentSquareIndex! + 1 > 10 ? "結果を見る 🎊" : "次のマスへ →"}
              </button>
            )}
          </div>
        )}

        {/* 相手のターン：視聴パネル */}
        {!isMyTurn && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-center text-xs font-black uppercase tracking-widest text-gray-400">
              👀 {opponentNickname} のプレイを見ています
            </p>

            {/* サイコロを振っている / 待機中 */}
            {(!opponentPresence || opponentPresence.action === "rolling" || (opponentPresence.action === "idle" && !opponentPresence.nextTurnPlayerId)) && (
              <div className="py-4 text-center">
                <div className="text-5xl animate-bounce">🎲</div>
                <p className="mt-3 text-sm font-bold text-amber-500 animate-pulse">ROLLING...</p>
              </div>
            )}

            {/* 着地した */}
            {opponentPresence?.action === "landed" && (
              <div className="py-2 text-center">
                <div className="text-6xl">{DICE_FACES[opponentPresence.diceValue ?? 1]}</div>
                <p className="mt-3 text-sm font-black text-gray-900">
                  {opponentPresence.diceValue} の目
                </p>
                <p className="text-xs text-gray-400">→ マス {opponentPresence.targetSquareIndex} へ</p>
              </div>
            )}

            {/* 分岐マスで選択中 */}
            {(opponentPresence?.action === "choosing" || opponentPresence?.action === "revealed") && opponentPresence.currentSquare && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-600">
                    🔀 マス {opponentPresence.currentSquare.index}
                  </span>
                </div>
                <p className="mb-3 text-sm font-medium leading-relaxed text-gray-700">
                  {opponentPresence.currentSquare.event}
                </p>
                {opponentPresence.action === "choosing" && (
                  <p className="text-center text-xs font-bold text-gray-400 animate-pulse">選択中...</p>
                )}
                {opponentPresence.action === "revealed" && (
                  <div className="space-y-2">
                    {([opponentPresence.currentSquare.choice_a, opponentPresence.currentSquare.choice_b] as const).map((choice, idx) => {
                      const isAnswer = opponentPresence.answerIndex === idx;
                      const isChosen = opponentPresence.chosenIndex === idx;
                      let btnClass = "w-full rounded-xl border-2 px-4 py-2.5 text-left text-sm font-medium";
                      if (isAnswer) btnClass += " border-emerald-400 bg-emerald-50 text-emerald-800";
                      else if (isChosen && !isAnswer) btnClass += " border-rose-400 bg-rose-50 text-rose-700";
                      else btnClass += " border-gray-100 bg-gray-50 text-gray-400";
                      return (
                        <div key={idx} className={btnClass}>
                          <span className="mr-2 font-black text-amber-500">{idx === 0 ? "A" : "B"}</span>
                          {choice}
                          {isAnswer && <span className="ml-2 text-emerald-600">← 正解</span>}
                          {isChosen && !isAnswer && <span className="ml-2 text-rose-500">← 選んだ</span>}
                        </div>
                      );
                    })}
                    <div className={`mt-2 rounded-xl border p-3 text-center text-sm font-black ${
                      opponentPresence.isCorrect
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-rose-300 bg-rose-50 text-rose-700"
                    }`}>
                      {opponentPresence.isCorrect ? "✓ 共感！" : "✗ 違う選択"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 効果マス */}
            {opponentPresence?.action === "effect_viewing" && opponentPresence.currentSquare && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-600">
                    ⚡ 効果マス {opponentPresence.currentSquare.index}
                  </span>
                </div>
                <p className="mb-3 text-sm font-medium text-gray-700">{opponentPresence.currentSquare.event}</p>
                <div className={`rounded-xl border p-3 text-center ${
                  opponentPresence.currentSquare.effect === 1
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-rose-200 bg-rose-50"
                }`}>
                  <p className={`text-xl font-black ${opponentPresence.currentSquare.effect === 1 ? "text-emerald-600" : "text-rose-600"}`}>
                    {opponentPresence.currentSquare.effect === 1 ? "⬆ 1マス進む！" : "⬇ 1マス戻る"}
                  </p>
                </div>
              </div>
            )}

            {/* ターン切り替え中 */}
            {opponentPresence?.action === "idle" && opponentPresence.nextTurnPlayerId && (
              <p className="text-center text-xs font-bold text-gray-400 animate-pulse">ターン切り替え中...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
