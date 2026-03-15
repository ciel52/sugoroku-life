"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { type SquareInput } from "@/lib/phases";

export default function BoardCreateForm({
  initialTitle,
  initialSquares,
  initialBirthPlace,
  initialBirthYear,
  isEditing,
}: {
  initialTitle: string;
  initialSquares: SquareInput[];
  initialBirthPlace: string;
  initialBirthYear: string;
  isEditing: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [birthPlace, setBirthPlace] = useState(initialBirthPlace);
  const [birthYear, setBirthYear] = useState(initialBirthYear);
  const [squares, setSquares] = useState<SquareInput[]>(initialSquares);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSquare(index: number, field: keyof SquareInput, value: string | number | "branch" | "effect") {
    setSquares((prev) =>
      prev.map((s) => (s.index === index ? { ...s, [field]: value } : s))
    );
  }

  function isSquareComplete(s: SquareInput): boolean {
    if (!s.event.trim()) return false;
    if (s.squareType === "branch") {
      return s.choiceA.trim() !== "" && s.choiceB.trim() !== "";
    }
    return true;
  }

  const completedCount = squares.filter(isSquareComplete).length;
  const allComplete = completedCount === 10;

  async function handleSave() {
    setError(null);
    setSaving(true);

    const res = await fetch("/api/board", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        squares,
        birthPlace: birthPlace.trim() || null,
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "保存に失敗しました");
      setSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* ヘッダー */}
        <div className="mb-8 text-center">
          <div className="text-4xl">🎲</div>
          <h1 className="mt-2 text-2xl font-bold text-amber-900">
            {isEditing ? "人生ボードを編集する" : "あなたの人生をすごろくにしよう"}
          </h1>
          <p className="mt-1 text-sm text-amber-700">
            0〜20歳の出来事を10マスに書いてください
          </p>
        </div>

        {/* タイトル入力 */}
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-gray-600">
            ボードのタイトル
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={30}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>

        {/* 出生情報（STARTマスに表示） */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">S</span>
            <span className="text-sm font-medium text-amber-700">START / 出生情報</span>
          </div>
          <p className="mb-3 text-xs text-gray-400">スタートマスに表示されます（任意）</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">生まれた場所</label>
              <input
                type="text"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                maxLength={50}
                placeholder="例: 東京都渋谷区"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">生まれた年</label>
              <input
                type="number"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                min={1900}
                max={2030}
                placeholder="例: 2000"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>
        </div>

        {/* 進捗バー */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-full bg-gray-200 h-2">
            <div
              className="h-2 rounded-full bg-amber-400 transition-all"
              style={{ width: `${(completedCount / 10) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500 shrink-0">{completedCount} / 10 完了</span>
        </div>

        {/* マス入力フォーム（全10マス） */}
        <div className="space-y-4">
          {squares.map((square) => (
            <div key={square.index} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {square.index}
                </span>
                <input
                  type="text"
                  value={square.age}
                  onChange={(e) => updateSquare(square.index, "age", e.target.value)}
                  maxLength={20}
                  placeholder="例: 5歳、小学2年生"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                {isSquareComplete(square) && (
                  <span className="text-green-400 text-sm shrink-0">✓</span>
                )}
              </div>

              {/* マス種別トグル */}
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-gray-500">マスの種類</label>
                <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                  {(["branch", "effect"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateSquare(square.index, "squareType", type)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                        square.squareType === type
                          ? "bg-white text-amber-700 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {type === "branch" ? "🔀 分岐マス" : "⚡ 効果マス"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 出来事テキスト（共通） */}
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-gray-500">出来事</label>
                <textarea
                  value={square.event}
                  onChange={(e) => updateSquare(square.index, "event", e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="例: 初めて自転車に乗れた日、何度も転んだ"
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>

              {/* 分岐マス用フィールド */}
              {square.squareType === "branch" && (
                <>
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">選択肢 A</label>
                      <input
                        type="text"
                        value={square.choiceA}
                        onChange={(e) => updateSquare(square.index, "choiceA", e.target.value)}
                        maxLength={100}
                        placeholder="例: もう乗らないと決めた"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">選択肢 B</label>
                      <input
                        type="text"
                        value={square.choiceB}
                        onChange={(e) => updateSquare(square.index, "choiceB", e.target.value)}
                        maxLength={100}
                        placeholder="例: 翌日また練習した"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      あなたが実際に選んだのは？
                    </label>
                    <div className="flex gap-2">
                      {(["A", "B"] as const).map((label, idx) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => updateSquare(square.index, "answerIndex", idx)}
                          className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                            square.answerIndex === idx
                              ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-gray-200 text-gray-400 hover:border-amber-300"
                          }`}
                        >
                          {label}を選んだ
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 効果マス用フィールド */}
              {square.squareType === "effect" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">効果</label>
                  <div className="flex gap-2">
                    {([1, -1] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => updateSquare(square.index, "effect", val)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                          square.effect === val
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-gray-200 text-gray-400 hover:border-amber-300"
                        }`}
                      >
                        {val === 1 ? "⬆️ 1マス進む" : "⬇️ 1マス戻る"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 保存ボタン */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={!allComplete || saving}
            className="w-full rounded-xl bg-green-500 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-40"
          >
            {saving ? "保存中..." : isEditing ? "✓ 変更を保存する" : "✓ ボードを完成させる"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <div className="mt-4 text-right text-xs text-gray-400">
          <a href="/" className="underline hover:text-gray-600">キャンセル</a>
        </div>
      </div>
    </div>
  );
}
