import Dexie, { type EntityTable } from "dexie";
import seed from "../data/seed.json";
import type {
  AppBackup,
  Attempt,
  MetaItem,
  PracticeSession,
  Question,
  QuestionBank,
  WrongItem,
  WrongStatus
} from "../types";
import { createId, getWrongId } from "./utils";

interface SeedData {
  bank: QuestionBank;
  questions: Question[];
}

class TijiDatabase extends Dexie {
  banks!: EntityTable<QuestionBank, "id">;
  questions!: EntityTable<Question, "id">;
  sessions!: EntityTable<PracticeSession, "id">;
  attempts!: EntityTable<Attempt, "id">;
  wrongItems!: EntityTable<WrongItem, "id">;
  meta!: EntityTable<MetaItem, "key">;

  constructor() {
    super("tiji-local");
    this.version(1).stores({
      banks: "id, contentHash, importedAt",
      questions: "id, bankId, type, sequence, fingerprint, [bankId+type]",
      sessions: "id, bankId, startedAt, completedAt",
      attempts:
        "id, sessionId, questionId, bankId, answeredAt, [sessionId+questionId]",
      wrongItems: "id, bankId, questionId, status, lastWrongAt",
      meta: "key"
    });
  }
}

export const db = new TijiDatabase();

const seedData = seed as SeedData;

let initializationPromise: Promise<void> | undefined;

async function initializeDatabaseInternal(): Promise<void> {
  await db.open();
  await db.transaction("rw", db.banks, db.questions, db.meta, async () => {
    const existing = await db.banks.get(seedData.bank.id);
    if (!existing) {
      await db.banks.add(seedData.bank);
      await db.questions.bulkAdd(seedData.questions);
    } else {
      const count = await db.questions.where("bankId").equals(existing.id).count();
      if (!count) {
        await db.questions.bulkAdd(seedData.questions);
      }
    }

    const active = await db.meta.get("activeBankId");
    const activeBank = active ? await db.banks.get(active.value) : undefined;
    if (!activeBank) {
      await db.meta.put({ key: "activeBankId", value: seedData.bank.id });
    }
  });
}

export function initializeDatabase(): Promise<void> {
  initializationPromise ??= initializeDatabaseInternal();
  return initializationPromise;
}

export interface AppSnapshot {
  banks: QuestionBank[];
  activeBankId: string;
  questions: Question[];
  sessions: PracticeSession[];
  attempts: Attempt[];
  wrongItems: WrongItem[];
}

export async function loadAppSnapshot(): Promise<AppSnapshot> {
  const banks = await db.banks.orderBy("importedAt").reverse().toArray();
  const activeMeta = await db.meta.get("activeBankId");
  const activeBankId =
    activeMeta && banks.some((bank) => bank.id === activeMeta.value)
      ? activeMeta.value
      : banks[0]?.id ?? seedData.bank.id;

  const [questions, sessions, attempts, wrongItems] = await Promise.all([
    db.questions.toArray(),
    db.sessions.orderBy("startedAt").reverse().toArray(),
    db.attempts.orderBy("answeredAt").reverse().toArray(),
    db.wrongItems.orderBy("lastWrongAt").reverse().toArray()
  ]);

  return {
    banks,
    activeBankId,
    questions,
    sessions,
    attempts,
    wrongItems
  };
}

export async function setActiveBank(bankId: string): Promise<void> {
  const bank = await db.banks.get(bankId);
  if (!bank) throw new Error("题库不存在");
  await db.meta.put({ key: "activeBankId", value: bankId });
}

export async function addQuestionBank(preview: {
  bank: QuestionBank;
  questions: Question[];
}): Promise<QuestionBank> {
  const existing = await db.banks
    .where("contentHash")
    .equals(preview.bank.contentHash)
    .first();
  if (existing) {
    await setActiveBank(existing.id);
    return existing;
  }

  await db.transaction("rw", db.banks, db.questions, db.meta, async () => {
    await db.banks.add(preview.bank);
    await db.questions.bulkAdd(preview.questions);
    await db.meta.put({ key: "activeBankId", value: preview.bank.id });
  });
  return preview.bank;
}

export async function createPracticeSession(input: {
  bank: QuestionBank;
  type: PracticeSession["type"];
  mode: PracticeSession["mode"];
  questionIds: string[];
}): Promise<PracticeSession> {
  const typeLabel = input.type === "all" ? "全部题型" : input.type;
  const modeLabel =
    input.mode === "random"
      ? "随机"
      : input.mode === "wrong"
        ? "错题重练"
        : "顺序";
  const session: PracticeSession = {
    id: createId("session"),
    bankId: input.bank.id,
    bankName: input.bank.name,
    type: input.type,
    mode: input.mode,
    title: `${typeLabel} · ${modeLabel}`,
    questionIds: input.questionIds,
    currentIndex: 0,
    startedAt: new Date().toISOString()
  };
  await db.sessions.add(session);
  return session;
}

export async function recordAttempt(input: {
  sessionId: string;
  question: Question;
  userAnswer: string;
  result: Attempt["result"];
  autoGraded: boolean;
  elapsedMs: number;
}): Promise<Attempt> {
  const now = new Date().toISOString();
  return db.transaction(
    "rw",
    db.attempts,
    db.sessions,
    db.wrongItems,
    async () => {
      const existing = await db.attempts
        .where("[sessionId+questionId]")
        .equals([input.sessionId, input.question.id])
        .first();
      if (existing) return existing;

      const session = await db.sessions.get(input.sessionId);
      if (!session) throw new Error("练习记录不存在");

      const attempt: Attempt = {
        id: createId("attempt"),
        sessionId: input.sessionId,
        bankId: input.question.bankId,
        questionId: input.question.id,
        questionType: input.question.type,
        answer: input.question.answer,
        userAnswer: input.userAnswer,
        result: input.result,
        autoGraded: input.autoGraded,
        answeredAt: now,
        elapsedMs: input.elapsedMs
      };
      await db.attempts.add(attempt);

      const wrongId = getWrongId(input.question.id);
      const wrong = await db.wrongItems.get(wrongId);
      if (input.result === "incorrect") {
        if (wrong) {
          await db.wrongItems.put({
            ...wrong,
            status: "active",
            wrongCount: wrong.wrongCount + 1,
            lastWrongAt: now,
            lastReviewedAt: now,
            masteredAt: undefined
          });
        } else {
          await db.wrongItems.add({
            id: wrongId,
            bankId: input.question.bankId,
            questionId: input.question.id,
            status: "active",
            wrongCount: 1,
            firstWrongAt: now,
            lastWrongAt: now,
            lastReviewedAt: now
          });
        }
      } else if (wrong?.status === "active") {
        await db.wrongItems.put({
          ...wrong,
          status: "mastered",
          lastReviewedAt: now,
          masteredAt: now
        });
      }

      return attempt;
    }
  );
}

export async function advanceSession(
  sessionId: string,
  currentIndex: number,
  complete = false
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("练习记录不存在");
  await db.sessions.put({
    ...session,
    currentIndex,
    ...(complete ? { completedAt: new Date().toISOString() } : {})
  });
}

export async function markWrongItem(
  questionId: string,
  status: WrongStatus
): Promise<void> {
  const id = getWrongId(questionId);
  const wrong = await db.wrongItems.get(id);
  if (!wrong) return;
  const now = new Date().toISOString();
  await db.wrongItems.put({
    ...wrong,
    status,
    lastReviewedAt: now,
    masteredAt: status === "mastered" ? now : undefined
  });
}

export async function exportBackup(): Promise<AppBackup> {
  const [banks, questions, sessions, attempts, wrongItems, meta] =
    await Promise.all([
      db.banks.toArray(),
      db.questions.toArray(),
      db.sessions.toArray(),
      db.attempts.toArray(),
      db.wrongItems.toArray(),
      db.meta.toArray()
    ]);
  return {
    schemaVersion: 1,
    app: "tiji-local",
    exportedAt: new Date().toISOString(),
    data: { banks, questions, sessions, attempts, wrongItems, meta }
  };
}

export async function restoreBackup(backup: AppBackup): Promise<void> {
  if (
    backup?.app !== "tiji-local" ||
    backup.schemaVersion !== 1 ||
    !Array.isArray(backup.data?.banks) ||
    !Array.isArray(backup.data?.questions)
  ) {
    throw new Error("备份文件格式不正确或版本不受支持");
  }

  await db.transaction(
    "rw",
    [
      db.banks,
      db.questions,
      db.sessions,
      db.attempts,
      db.wrongItems,
      db.meta
    ],
    async () => {
      await Promise.all([
        db.banks.clear(),
        db.questions.clear(),
        db.sessions.clear(),
        db.attempts.clear(),
        db.wrongItems.clear(),
        db.meta.clear()
      ]);
      await db.banks.bulkAdd(backup.data.banks);
      await db.questions.bulkAdd(backup.data.questions);
      await db.sessions.bulkAdd(backup.data.sessions ?? []);
      await db.attempts.bulkAdd(backup.data.attempts ?? []);
      await db.wrongItems.bulkAdd(backup.data.wrongItems ?? []);
      await db.meta.bulkAdd(backup.data.meta ?? []);
    }
  );
  await initializeDatabase();
}

export async function deleteAllPracticeData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.sessions, db.attempts, db.wrongItems],
    async () => {
      await Promise.all([
        db.sessions.clear(),
        db.attempts.clear(),
        db.wrongItems.clear()
      ]);
    }
  );
}
