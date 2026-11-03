import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Layout, type Screen } from "./components/Layout";
import { Toast } from "./components/ui";
import {
  createPracticeSession,
  initializeDatabase,
  loadAppSnapshot,
  markWrongItem,
  type AppSnapshot
} from "./lib/db";
import {
  activeWrongQuestionIds,
  shuffle
} from "./lib/utils";
import type {
  PracticeMode,
  QuestionType,
  WrongStatus
} from "./types";
import { Dashboard } from "./screens/Dashboard";
import { PracticeSetup } from "./screens/PracticeSetup";
import { Quiz } from "./screens/Quiz";
import { WrongBook } from "./screens/WrongBook";
import { History } from "./screens/History";
import { BankData } from "./screens/BankData";

type PracticeType = QuestionType | "all";
type ToastState = {
  message: string;
  type: "success" | "error" | "info";
};

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialType, setInitialType] = useState<PracticeType>("all");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [fatalError, setFatalError] = useState("");

  const refresh = useCallback(async () => {
    const next = await loadAppSnapshot();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    let alive = true;
    async function start() {
      try {
        await initializeDatabase();
        if (navigator.storage?.persist) {
          await navigator.storage.persist().catch(() => false);
        }
        const next = await loadAppSnapshot();
        if (alive) setSnapshot(next);
      } catch (error) {
        if (alive) {
          setFatalError(
            error instanceof Error
              ? error.message
              : "本机数据库初始化失败"
          );
        }
      }
    }
    void start();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeBank = useMemo(
    () =>
      snapshot?.banks.find((bank) => bank.id === snapshot.activeBankId) ??
      snapshot?.banks[0],
    [snapshot]
  );
  const activeQuestions = useMemo(
    () =>
      snapshot?.questions.filter(
        (question) => question.bankId === snapshot.activeBankId
      ) ?? [],
    [snapshot]
  );
  const activeSession = useMemo(
    () =>
      snapshot?.sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, snapshot]
  );

  function showToast(
    message: string,
    type: ToastState["type"] = "success"
  ) {
    setToast({ message, type });
  }

  function navigate(next: Exclude<Screen, "quiz">) {
    if (next === "practice") setInitialType("all");
    setScreen(next);
  }

  function openPractice(type: PracticeType = "all") {
    setInitialType(type);
    setScreen("practice");
  }

  async function startPractice(
    type: PracticeType,
    mode: PracticeMode,
    count: number
  ) {
    if (!snapshot || !activeBank) return;
    const wrongIds = activeWrongQuestionIds(snapshot.wrongItems, activeBank.id);
    let candidates =
      type === "all"
        ? activeQuestions
        : activeQuestions.filter((question) => question.type === type);
    if (mode === "wrong") {
      candidates = candidates.filter((question) => wrongIds.has(question.id));
    }
    if (mode === "random") candidates = shuffle(candidates);
    if (mode === "sequence") {
      candidates = [...candidates].sort((a, b) => a.sequence - b.sequence);
    }
    const selected = candidates.slice(0, Math.max(1, count));
    if (!selected.length) {
      showToast("当前筛选下没有可练习的题目", "info");
      return;
    }
    try {
      const session = await createPracticeSession({
        bank: activeBank,
        type,
        mode,
        questionIds: selected.map((question) => question.id)
      });
      await refresh();
      setActiveSessionId(session.id);
      setScreen("quiz");
      window.scrollTo({ top: 0 });
    } catch {
      showToast("创建练习失败，请重试", "error");
    }
  }

  async function practiceSpecific(questionIds: string[]) {
    if (!activeBank || !questionIds.length) return;
    try {
      const session = await createPracticeSession({
        bank: activeBank,
        type: "all",
        mode: "wrong",
        questionIds
      });
      await refresh();
      setActiveSessionId(session.id);
      setScreen("quiz");
      window.scrollTo({ top: 0 });
    } catch {
      showToast("创建错题练习失败，请重试", "error");
    }
  }

  function resumeSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setScreen("quiz");
    window.scrollTo({ top: 0 });
  }

  async function updateWrongStatus(
    questionId: string,
    status: WrongStatus
  ) {
    try {
      await markWrongItem(questionId, status);
      await refresh();
      showToast(status === "mastered" ? "已标记为已掌握" : "已重新加入错题本");
    } catch {
      showToast("更新错题状态失败", "error");
    }
  }

  if (fatalError) {
    return (
      <div className="fatal-screen">
        <AlertCircle size={34} />
        <h1>无法打开本机数据</h1>
        <p>{fatalError}</p>
        <p>请确认浏览器允许使用本地存储，或换用最新版 Chrome、Edge、Safari。</p>
        <button className="button button-dark" type="button" onClick={() => location.reload()}>
          重新加载
        </button>
      </div>
    );
  }

  if (!snapshot || !activeBank) {
    return (
      <div className="loading-screen">
        <span className="brand-mark large">题</span>
        <LoaderCircle className="spin" size={24} />
        <p>正在准备本机题库...</p>
      </div>
    );
  }

  let content: ReactNode;
  if (screen === "quiz" && activeSession) {
    content = (
      <Quiz
        key={activeSession.id}
        session={activeSession}
        questions={snapshot.questions}
        attempts={snapshot.attempts}
        onExit={() => setScreen("dashboard")}
        onDataChanged={refresh}
        onPracticeAgain={() => openPractice("all")}
      />
    );
  } else if (screen === "practice") {
    content = (
      <PracticeSetup
        key={`${activeBank.id}-${initialType}`}
        bank={activeBank}
        questions={activeQuestions}
        wrongItems={snapshot.wrongItems}
        initialType={initialType}
        onStart={startPractice}
      />
    );
  } else if (screen === "wrong") {
    content = (
      <WrongBook
        bank={activeBank}
        questions={activeQuestions}
        wrongItems={snapshot.wrongItems}
        onPractice={practiceSpecific}
        onMark={updateWrongStatus}
        onGoPractice={() => openPractice("all")}
      />
    );
  } else if (screen === "history") {
    content = (
      <History
        sessions={snapshot.sessions}
        attempts={snapshot.attempts}
        questions={snapshot.questions}
        onResume={(session) => resumeSession(session.id)}
        onPractice={() => openPractice("all")}
      />
    );
  } else if (screen === "banks") {
    content = (
      <BankData
        banks={snapshot.banks}
        activeBankId={snapshot.activeBankId}
        onRefresh={refresh}
        onToast={showToast}
      />
    );
  } else {
    content = (
      <Dashboard
        bank={activeBank}
        questions={activeQuestions}
        attempts={snapshot.attempts}
        sessions={snapshot.sessions}
        wrongItems={snapshot.wrongItems}
        onPractice={openPractice}
        onResume={(session) => resumeSession(session.id)}
        onWrong={() => setScreen("wrong")}
        onHistory={() => setScreen("history")}
      />
    );
  }

  return (
    <>
      <Layout screen={screen} onNavigate={navigate} bankName={activeBank.name}>
        {content}
      </Layout>
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
