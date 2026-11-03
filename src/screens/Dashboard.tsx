import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Flame,
  Play,
  RotateCcw,
  Sparkles
} from "lucide-react";
import type {
  Attempt,
  PracticeSession,
  Question,
  QuestionBank,
  QuestionType,
  WrongItem
} from "../types";
import { QUESTION_TYPES } from "../types";
import {
  calculateStreak,
  formatDate,
  isToday,
  modeLabel,
  scoreSession,
  TYPE_META,
  typeStats
} from "../lib/utils";
import { ProgressBar } from "../components/ui";

const TYPE_ICONS: Record<QuestionType, string> = {
  单选题: "A",
  多选题: "◫",
  填空题: "＿",
  简答题: "¶"
};

export function Dashboard({
  bank,
  questions,
  attempts,
  sessions,
  wrongItems,
  onPractice,
  onResume,
  onWrong,
  onHistory
}: {
  bank: QuestionBank;
  questions: Question[];
  attempts: Attempt[];
  sessions: PracticeSession[];
  wrongItems: WrongItem[];
  onPractice: (type?: QuestionType | "all") => void;
  onResume: (session: PracticeSession) => void;
  onWrong: () => void;
  onHistory: () => void;
}) {
  const bankAttempts = attempts.filter((attempt) => attempt.bankId === bank.id);
  const bankSessions = sessions.filter((session) => session.bankId === bank.id);
  const todayAttempts = bankAttempts.filter((attempt) => isToday(attempt.answeredAt));
  const todayCorrect = todayAttempts.filter(
    (attempt) => attempt.result === "correct"
  ).length;
  const activeWrong = wrongItems.filter(
    (item) => item.bankId === bank.id && item.status === "active"
  );
  const incomplete = bankSessions.find((session) => !session.completedAt);
  const completed = bankSessions
    .filter((session) => session.completedAt)
    .slice(0, 3);
  const stats = typeStats(questions, bankAttempts);
  const streak = calculateStreak(bankAttempts);
  const objectiveAttempts = bankAttempts.filter((attempt) => attempt.autoGraded);
  const objectiveCorrect = objectiveAttempts.filter(
    (attempt) => attempt.result === "correct"
  ).length;
  const accuracy = objectiveAttempts.length
    ? Math.round((objectiveCorrect / objectiveAttempts.length) * 100)
    : null;
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "早上好" : hour < 18 ? "下午好" : "晚上好";
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());

  return (
    <div className="page dashboard-page">
      <header className="page-heading dashboard-heading">
        <div>
          <p className="eyebrow">
            <CalendarDays size={15} />
            {dateText}
          </p>
          <h1>{greeting}，今天练几道？</h1>
          <p>每一次作答都会沉淀为清晰的学习轨迹。</p>
        </div>
        <div className="bank-pill" title={bank.name}>
          <span />
          {bank.name}
        </div>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow light">
            <Sparkles size={15} />
            {incomplete ? "上次练习还未结束" : "从一组随机题开始"}
          </span>
          <h2>
            {incomplete ? "接着上次的进度继续" : "保持手感，也保持思考"}
          </h2>
          <p>
            {incomplete
              ? `${incomplete.title} · 已完成 ${incomplete.currentIndex} / ${incomplete.questionIds.length} 道`
              : `当前题库共 ${bank.questionCount} 道题，覆盖单选、多选、填空与简答。`}
          </p>
          <div className="hero-actions">
            <button
              className="button button-accent"
              type="button"
              onClick={() =>
                incomplete ? onResume(incomplete) : onPractice("all")
              }
            >
              <Play size={17} fill="currentColor" />
              {incomplete ? "继续练习" : "开始练习"}
            </button>
            <button
              className="button button-ghost-light"
              type="button"
              onClick={() => onPractice("all")}
            >
              新开一组
            </button>
          </div>
        </div>
        <div
          className="accuracy-orbit"
          style={{
            background: `conic-gradient(#d9e36e 0 ${accuracy ?? 0}%, rgba(255,255,255,.12) ${accuracy ?? 0}% 100%)`
          }}
          aria-label={accuracy === null ? "暂无答对率" : `历史答对率 ${accuracy}%`}
        >
          <div>
            <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
            <span>客观题正确率</span>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="学习概览">
        <article className="metric-card">
          <span className="metric-icon green">
            <BookOpen size={19} />
          </span>
          <div>
            <p>今日已答</p>
            <strong>{todayAttempts.length}</strong>
            <small>
              正确 {todayCorrect} 道
            </small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon coral">
            <CircleHelp size={19} />
          </span>
          <div>
            <p>待复习错题</p>
            <strong>{activeWrong.length}</strong>
            <small>{activeWrong.length ? "趁记忆还热，回顾一下" : "错题本很干净"}</small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon amber">
            <Flame size={19} />
          </span>
          <div>
            <p>连续学习</p>
            <strong>{streak}</strong>
            <small>天</small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-icon blue">
            <Clock3 size={19} />
          </span>
          <div>
            <p>累计作答</p>
            <strong>{bankAttempts.length}</strong>
            <small>道</small>
          </div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>按题型练习</h2>
            <p>每种题型都有独立的正确率与掌握情况。</p>
          </div>
          <button className="text-button" type="button" onClick={() => onPractice("all")}>
            全部题型 <ArrowRight size={16} />
          </button>
        </div>
        <div className="type-grid">
          {QUESTION_TYPES.map((type) => {
            const stat = stats.find((item) => item.type === type)!;
            const meta = TYPE_META[type];
            return (
              <button
                className={`type-card type-card-${meta.color}`}
                key={type}
                type="button"
                onClick={() => onPractice(type)}
              >
                <span className="type-icon">{TYPE_ICONS[type]}</span>
                <span className="type-card-copy">
                  <span className="type-card-top">
                    <strong>{type}</strong>
                    <small>{bank.breakdown[type]} 题</small>
                  </span>
                  <span className="type-accuracy-row">
                    <span>
                      {stat.accuracy === null
                        ? "尚未练习"
                        : `正确率 ${Math.round(stat.accuracy * 100)}%`}
                    </span>
                    <ArrowRight size={16} />
                  </span>
                  <ProgressBar
                    value={(stat.accuracy ?? 0) * 100}
                    tone={meta.color === "amber" ? "amber" : meta.color === "blue" ? "blue" : "green"}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="dashboard-lower-grid">
        <article className="content-card recent-card">
          <div className="card-heading">
            <div>
              <h2>最近练习</h2>
              <p>已经完成的练习会留在这里。</p>
            </div>
            <button className="text-button" type="button" onClick={onHistory}>
              全部记录 <ArrowRight size={16} />
            </button>
          </div>
          {completed.length ? (
            <div className="session-list compact">
              {completed.map((session) => {
                const score = scoreSession(session, attempts);
                return (
                  <button
                    type="button"
                    className="session-row"
                    key={session.id}
                    onClick={onHistory}
                  >
                    <span className="session-status">
                      <CheckCircle2 size={18} />
                    </span>
                    <span className="session-main">
                      <strong>{session.title}</strong>
                      <small>{formatDate(session.completedAt ?? session.startedAt)}</small>
                    </span>
                    <span className="session-score">
                      {score.correct}/{score.answered}
                      <small>答对</small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mini-empty">
              <RotateCcw size={22} />
              <p>完成第一组练习后，这里会出现学习记录。</p>
            </div>
          )}
        </article>

        <article className="review-card" onClick={onWrong}>
          <div>
            <span className="eyebrow light">错题回看</span>
            <h2>{activeWrong.length ? `${activeWrong.length} 道题等你复习` : "今天没有待复习错题"}</h2>
            <p>
              {activeWrong.length
                ? "先回看，再重练。答对后题目会自动标记为已掌握。"
                : "答错的题会自动收集，复习答对后再从错题本中移出。"}
            </p>
            <button type="button" className="text-button light">
              {activeWrong.length ? "打开错题本" : "查看错题本"} <ArrowRight size={16} />
            </button>
          </div>
          <div className="review-illustration" aria-hidden="true">
            <span>?</span>
            <span>✓</span>
            <span>!</span>
          </div>
        </article>
      </section>
    </div>
  );
}
