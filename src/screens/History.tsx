import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  History as HistoryIcon,
  PlayCircle,
  XCircle
} from "lucide-react";
import type { Attempt, PracticeSession, Question } from "../types";
import {
  formatDate,
  formatDuration,
  modeLabel,
  scoreSession,
  sessionAttempts
} from "../lib/utils";
import { EmptyState, TypeBadge } from "../components/ui";

export function History({
  sessions,
  attempts,
  questions,
  onResume,
  onPractice
}: {
  sessions: PracticeSession[];
  attempts: Attempt[];
  questions: Question[];
  onResume: (session: PracticeSession) => void;
  onPractice: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const completedCount = sessions.filter((session) => session.completedAt).length;
  const scored = attempts.length;
  const correct = attempts.filter((attempt) => attempt.result === "correct").length;

  return (
    <div className="page history-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <HistoryIcon size={15} />
            每一次作答都有迹可循
          </p>
          <h1>练习记录</h1>
          <p>按时间和练习批次查看，历史记录不会因错题状态变化而删除。</p>
        </div>
        <div className="history-summary">
          <div>
            <strong>{completedCount}</strong>
            <span>完成批次</span>
          </div>
          <div>
            <strong>{scored}</strong>
            <span>累计作答</span>
          </div>
          <div>
            <strong>{scored ? Math.round((correct / scored) * 100) : 0}%</strong>
            <span>整体答对率</span>
          </div>
        </div>
      </header>

      {sessions.length ? (
        <div className="history-list">
          {sessions.map((session) => {
            const score = scoreSession(session, attempts);
            const scopedAttempts = sessionAttempts(session, attempts);
            const isOpen = expanded === session.id;
            const totalMs = scopedAttempts.reduce(
              (total, attempt) => total + attempt.elapsedMs,
              0
            );
            return (
              <article className={`history-card ${isOpen ? "open" : ""}`} key={session.id}>
                <button
                  className="history-card-head"
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : session.id)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`history-icon ${session.completedAt ? "complete" : "open-state"}`}
                  >
                    {session.completedAt ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <PlayCircle size={20} />
                    )}
                  </span>
                  <span className="history-title-block">
                    <strong>{session.title}</strong>
                    <small>
                      {session.bankName} · {formatDate(session.startedAt)}
                    </small>
                  </span>
                  <span className="history-meta-pill">
                    {session.completedAt ? modeLabel(session.mode) : "进行中"}
                  </span>
                  <span className="history-score-block">
                    <strong>
                      {score.answered}
                      <small> / {session.questionIds.length}</small>
                    </strong>
                    <span>
                      {score.answered ? `${Math.round(score.accuracy * 100)}% 答对` : "未作答"}
                    </span>
                  </span>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {isOpen && (
                  <div className="history-detail">
                    {!session.completedAt && (
                      <div className="resume-strip">
                        <div>
                          <strong>这组练习尚未完成</strong>
                          <span>
                            已完成 {score.answered} / {session.questionIds.length} 道
                          </span>
                        </div>
                        <button
                          className="button button-small button-dark"
                          type="button"
                          onClick={() => onResume(session)}
                        >
                          继续练习 <ArrowRight size={15} />
                        </button>
                      </div>
                    )}
                    <div className="history-detail-summary">
                      <span>
                        <Clock3 size={15} />
                        {formatDuration(totalMs)}
                      </span>
                      <span>
                        <CheckCircle2 size={15} />
                        正确 {score.correct} 道
                      </span>
                      <span>
                        <XCircle size={15} />
                        待巩固 {score.incorrect} 道
                      </span>
                    </div>
                    {scopedAttempts.length ? (
                      <div className="attempt-list">
                        {scopedAttempts.map((attempt, attemptIndex) => {
                          const question = questionMap.get(attempt.questionId);
                          return (
                            <div className="attempt-row" key={attempt.id}>
                              <span
                                className={`attempt-index ${attempt.result === "correct" ? "correct" : "wrong"}`}
                              >
                                {attemptIndex + 1}
                              </span>
                              <div>
                                <div className="attempt-title">
                                  <TypeBadge type={attempt.questionType} />
                                  <strong>
                                    {question?.stem ?? "题目已不在当前题库中"}
                                  </strong>
                                </div>
                                <p>
                                  你的答案：<span>{attempt.userAnswer || "未填写"}</span>
                                  {attempt.result === "incorrect" && (
                                    <>
                                      　参考答案：<strong>{attempt.answer}</strong>
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="history-empty-note">尚未作答任何题目。</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<HistoryIcon size={30} />}
          title="还没有练习记录"
          description="开始第一组练习后，每道题的作答结果和耗时都会记录在这里。"
          action={
            <button className="button button-dark" type="button" onClick={onPractice}>
              开始练习 <ArrowRight size={16} />
            </button>
          }
        />
      )}
    </div>
  );
}
