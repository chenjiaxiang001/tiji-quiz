import type {
  Attempt,
  PracticeSession,
  Question,
  QuestionType,
  TypeStat,
  WrongItem
} from "../types";
import { QUESTION_TYPES } from "../types";

export const TYPE_META: Record<
  QuestionType,
  { short: string; description: string; color: string }
> = {
  单选题: { short: "单选", description: "四选一，自动判分", color: "green" },
  多选题: { short: "多选", description: "按选项集合判分", color: "blue" },
  填空题: { short: "填空", description: "对比参考答案后自评", color: "amber" },
  简答题: { short: "简答", description: "对照参考答案自评", color: "coral" }
};

export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function formatDate(value: string, withTime = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    ...(withTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {})
  }).format(date);
}

export function startOfDay(date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function isToday(value: string): boolean {
  return new Date(value).getTime() >= startOfDay().getTime();
}

export function calculateStreak(attempts: Attempt[]): number {
  if (!attempts.length) return 0;
  const days = new Set(
    attempts.map((item) => {
      const date = new Date(item.answeredAt);
      return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    })
  );
  const cursor = startOfDay();
  const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function sessionAttempts(
  session: PracticeSession,
  attempts: Attempt[]
): Attempt[] {
  return attempts
    .filter((attempt) => attempt.sessionId === session.id)
    .sort(
      (a, b) =>
        new Date(a.answeredAt).getTime() - new Date(b.answeredAt).getTime()
    );
}

export function typeStats(
  questions: Question[],
  attempts: Attempt[]
): TypeStat[] {
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  return QUESTION_TYPES.map((type) => {
    const scoped = attempts.filter(
      (attempt) => questionMap.get(attempt.questionId)?.type === type
    );
    const correct = scoped.filter((attempt) => attempt.result === "correct").length;
    return {
      type,
      answered: scoped.length,
      correct,
      accuracy: scoped.length ? correct / scoped.length : null,
      objectiveAnswered: scoped.filter((attempt) => attempt.autoGraded).length,
      subjectiveAnswered: scoped.filter((attempt) => !attempt.autoGraded).length
    };
  });
}

export function getWrongId(questionId: string): string {
  return `wrong:${questionId}`;
}

export function activeWrongQuestionIds(
  wrongItems: WrongItem[],
  bankId: string
): Set<string> {
  return new Set(
    wrongItems
      .filter((item) => item.bankId === bankId && item.status === "active")
      .map((item) => item.questionId)
  );
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function answerLetters(value: string): string {
  return [...value.toUpperCase().replace(/[^A-E]/g, "")].sort().join("");
}

export function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s"'“”‘’`]/g, "")
    .replace(/[，,。；;、：:（）()[\]【】<>《》]/g, "")
    .replace(/[.!?！？]$/g, "");
}

export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "0 秒";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

export function modeLabel(mode: PracticeSession["mode"]): string {
  return mode === "random" ? "随机练习" : mode === "wrong" ? "错题重练" : "顺序练习";
}

export function scoreSession(session: PracticeSession, attempts: Attempt[]) {
  const scoped = sessionAttempts(session, attempts);
  const correct = scoped.filter((attempt) => attempt.result === "correct").length;
  return {
    answered: scoped.length,
    correct,
    incorrect: scoped.length - correct,
    accuracy: scoped.length ? correct / scoped.length : 0
  };
}
