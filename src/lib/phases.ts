export type Phase = {
  label: string;
  ageRange: string;
  squareIndices: [number, number];
};

export const PHASES: Phase[] = [
  { label: "幼少期",   ageRange: "0〜4歳",   squareIndices: [1, 2] },
  { label: "小学生",   ageRange: "5〜11歳",  squareIndices: [3, 4] },
  { label: "中学生",   ageRange: "12〜14歳", squareIndices: [5, 6] },
  { label: "高校生",   ageRange: "15〜17歳", squareIndices: [7, 8] },
  { label: "18〜20歳", ageRange: "18〜20歳", squareIndices: [9, 10] },
];

export function getPhaseByIndex(index: number): Phase {
  return PHASES.find((p) =>
    index >= p.squareIndices[0] && index <= p.squareIndices[1]
  )!;
}

export type SquareType = "branch" | "effect";

export type SquareInput = {
  index: number;
  phase: string;
  ageRange: string;
  event: string;
  squareType: SquareType;
  // 分岐マス用
  choiceA: string;
  choiceB: string;
  answerIndex: 0 | 1;
  // 効果マス用
  effect: 1 | -1;
};

export function createEmptySquares(): SquareInput[] {
  return Array.from({ length: 10 }, (_, i) => {
    const index = i + 1;
    const phase = getPhaseByIndex(index);
    return {
      index,
      phase: phase.label,
      ageRange: phase.ageRange,
      event: "",
      squareType: "branch",
      choiceA: "",
      choiceB: "",
      answerIndex: 0,
      effect: 1,
    };
  });
}
