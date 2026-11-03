export const QUESTION_TYPES = ["单选题", "多选题", "填空题", "简答题"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type PracticeMode = "sequence" | "random" | "wrong";
export type AttemptResult = "correct" | "incorrect";
export type WrongStatus = "active" | "mastered";

export interface QuestionBank {
  id: string;
  name: string;
  sourceFile: string;
  importedAt: string;
  questionCount: number;
  contentHash: string;
  builtIn: boolean;
  breakdown: Record<QuestionType, number>;
}

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  sequence: number;
  stem: string;
  options: string[];
  answer: string;
  reference: string;
  sourceRow: number;
  fingerprint: string;
}

export interface PracticeSession {
  id: string;
  bankId: string;
  bankName: string;
  type: QuestionType | "all";
  mode: PracticeMode;
  title: string;
  questionIds: string[];
  currentIndex: number;
  startedAt: string;
  completedAt?: string;
}

export interface Attempt {
  id: string;
  sessionId: string;
  bankId: string;
  questionId: string;
  questionType: QuestionType;
  answer: string;
  userAnswer: string;
  result: AttemptResult;
  autoGraded: boolean;
  answeredAt: string;
  elapsedMs: number;
}

export interface WrongItem {
  id: string;
  bankId: string;
  questionId: string;
  status: WrongStatus;
  wrongCount: number;
  firstWrongAt: string;
  lastWrongAt: string;
  lastReviewedAt?: string;
  masteredAt?: string;
}

export interface MetaItem {
  key: string;
  value: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportPreview {
  bank: QuestionBank;
  questions: Question[];
  warnings: string[];
  errors: ImportError[];
}

export interface AppBackup {
  schemaVersion: 1;
  app: "tiji-local";
  exportedAt: string;
  data: {
    banks: QuestionBank[];
    questions: Question[];
    sessions: PracticeSession[];
    attempts: Attempt[];
    wrongItems: WrongItem[];
    meta: MetaItem[];
  };
}

export interface TypeStat {
  type: QuestionType;
  answered: number;
  correct: number;
  accuracy: number | null;
  objectiveAnswered: number;
  subjectiveAnswered: number;
}
