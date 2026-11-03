import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Lightbulb,
  RotateCcw,
  Sparkles,
  X,
  XCircle
} from "lucide-react";
import type { Attempt, PracticeSession, Question } from "../types";
import {
  advanceSession,
  recordAttempt
} from "../lib/db";
import { gradeAnswer, isAnswerEmpty } from "../lib/grading";
import {
  answerLetters,
  formatDuration,
  scoreSession,
  sessionAttempts
} from "../lib/utils";
import { TypeBadge } from "../components/ui";

export function Quiz({
  session,
  questions,
  attempts,
  onExit,
  onDataChanged,
  onPracticeAgain
}: {
  session: PracticeSession;
  questions: Question[];
  attempts: Attempt[];
  onExit: () => void;
  onDataChanged: () => Promise<void>;
  onPracticeAgain: () => void;
}) {
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const sessionQuestions = useMemo(
    () =>
      session.questionIds
        .map((id) => questionMap.get(id))
        .filter((question): question is Question => Boolean(question)),
    [questionMap, session.questionIds]
  );
  const initialIndex = Math.min(
    Math.max(session.currentIndex, 0),
    Math.max(sessionQuestions.length - 1, 0)
  );
  const [index, setIndex] = useState(initialIndex);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestedCorrect, setSuggestedCorrect] = useState<boolean | undefined>();
  const [savingError, setSavingError] = useState("");
  const startedAt = useRef(Date.now());
  const question = sessionQuestions[index];
  const currentAttempt = question
    ? attempts.find(
        (attempt) =>
          attempt.sessionId === session.id &&
          attempt.questionId === question.id
      )
    : undefined;
  const score = scoreSession(session, attempts);

  useEffect(() => {
    if (currentAttempt) {
      setDraft(currentAttempt.userAnswer);
      setRevealed(true);
      setSuggestedCorrect(currentAttempt.result === "correct");
    } else {
      setRevealed(false);
      setDraft("");
      setSuggestedCorrect(undefined);
    }
    startedAt.current = Date.now();
  }, [currentAttempt?.id, index]);

  if (session.completedAt) {
    const finalScore = scoreSession(session, attempts);
    return (
      <div className="page session-complete-page">
        <div className="completion-card">
          <div
            className="completion-ring"
            style={{
              background: `conic-gradient(#d9e36e 0 ${Math.round(finalScore.accuracy * 100)}%, rgba(255,255,255,.13) ${Math.round(finalScore.accuracy * 100)}% 100%)`
            }}
          >
            <div>
              <strong>{Math.round(finalScore.accuracy * 100)}%</strong>
              <span>本组正确率</span>
            </div>
          </div>
          <p className="eyebrow light">
            <Sparkles size={15} />
            练习完成
          </p>
          <h1>这一组已经留下记录</h1>
          <p className="completion-copy">
            {session.title} 共完成 {finalScore.answered} 道题。答错的题已自动加入错题本。
          </p>
          <div className="completion-stats">
            <div>
              <CheckCircle2 size={20} />
              <strong>{finalScore.correct}</strong>
              <span>答对</span>
            </div>
            <div>
              <XCircle size={20} />
              <strong>{finalScore.incorrect}</strong>
              <span>待巩固</span>
            </div>
            <div>
              <Clock3 size={20} />
              <strong>
                {formatDuration(
                  sessionAttempts(session, attempts).reduce(
                    (total, attempt) => total + attempt.elapsedMs,
                    0
                  )
                )}
              </strong>
              <span>本组用时</span>
            </div>
          </div>
          <div className="completion-actions">
            <button className="button button-accent" type="button" onClick={onPracticeAgain}>
              <RotateCcw size={17} />
              再练一组
            </button>
            <button className="button button-ghost-light" type="button" onClick={onExit}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="page">
        <div className="inline-error">
          <CircleHelp size={22} />
          <div>
            <strong>这道题不在当前题库中</strong>
            <p>题库可能已切换，请返回练习记录查看已作答内容。</p>
          </div>
          <button className="button" type="button" onClick={onExit}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const answered = attempts.filter(
    (attempt) => attempt.sessionId === session.id
  ).length;
  const progress = ((index + (revealed ? 1 : 0)) / sessionQuestions.length) * 100;

  function toggleOption(letter: string) {
    if (revealed) return;
    if (question.type === "单选题") {
      setDraft(letter);
      return;
    }
    const selected = new Set(answerLetters(draft).split(""));
    if (selected.has(letter)) selected.delete(letter);
    else selected.add(letter);
    setDraft([...selected].sort().join(""));
  }

  async function submitAnswer() {
    if (isAnswerEmpty(question, draft)) {
      setSavingError(
        question.type === "单选题" || question.type === "多选题"
          ? "请先选择答案。"
          : "请先填写你的答案。"
      );
      return;
    }
    setSavingError("");
    const grade = gradeAnswer(question, draft);
    if (grade.automatic && grade.result) {
      setSaving(true);
      try {
        await recordAttempt({
          sessionId: session.id,
          question,
          userAnswer: draft,
          result: grade.result,
          autoGraded: true,
          elapsedMs: Date.now() - startedAt.current
        });
        await onDataChanged();
        setRevealed(true);
      } catch {
        setSavingError("保存答案失败，请重试。");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSuggestedCorrect(grade.suggestedCorrect);
    setRevealed(true);
  }

  async function saveSelfAssessment(result: Attempt["result"]) {
    setSaving(true);
    setSavingError("");
    try {
      await recordAttempt({
        sessionId: session.id,
        question,
        userAnswer: draft,
        result,
        autoGraded: false,
        elapsedMs: Date.now() - startedAt.current
      });
      await onDataChanged();
      setSuggestedCorrect(result === "correct");
    } catch {
      setSavingError("保存答案失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  async function nextQuestion() {
    setSaving(true);
    setSavingError("");
    const isLast = index >= sessionQuestions.length - 1;
    try {
      await advanceSession(
        session.id,
        isLast ? sessionQuestions.length : index + 1,
        isLast
      );
      await onDataChanged();
      if (!isLast) {
        setIndex(index + 1);
        setDraft("");
        setRevealed(false);
        setSuggestedCorrect(undefined);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSavingError("更新练习进度失败，请重试。");
    } finally {
      setSaving(false);
    }
  }

  const subjectiveAnswered =
    !question.type.includes("选") && currentAttempt !== undefined;
  const needsSelfAssessment = revealed && !currentAttempt && !subjectiveAnswered;
  const selection = new Set(answerLetters(draft).split(""));

  return (
    <div className="page quiz-page">
      <header className="quiz-header">
        <button className="icon-text-button" type="button" onClick={onExit}>
          <ArrowLeft size={18} />
          退出
        </button>
        <div className="quiz-heading-title">
          <strong>{session.title}</strong>
          <span>{session.bankName}</span>
        </div>
        <span className="quiz-counter">
          {index + 1} / {sessionQuestions.length}
        </span>
      </header>

      <div className="quiz-progress-row">
        <div className="quiz-progress-track">
          <span style={{ width: `${Math.max(progress, 4)}%` }} />
        </div>
        <span>已答 {answered} 道</span>
      </div>

      <article className="question-card">
        <div className="question-meta">
          <div>
            <TypeBadge type={question.type} />
            <span>第 {question.sequence} 题</span>
          </div>
          <span className="question-hint">
            {question.type === "多选题"
              ? "选择所有正确选项"
              : question.type.includes("选")
                ? "选择一项"
                : "填写后对照参考答案"}
          </span>
        </div>
        <h1 className="question-stem">{question.stem}</h1>

        {question.options.length > 0 ? (
          <div className="option-list">
            {question.options.map((option, optionIndex) => {
              const letter = String.fromCharCode(65 + optionIndex);
              const selected = selection.has(letter);
              const correct = answerLetters(question.answer).includes(letter);
              return (
                <button
                  type="button"
                  key={letter}
                  className={[
                    "option-button",
                    selected ? "selected" : "",
                    revealed && correct ? "correct" : "",
                    revealed && selected && !correct ? "wrong" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleOption(letter)}
                  disabled={revealed}
                >
                  <span className="option-letter">
                    {revealed && correct ? (
                      <Check size={18} />
                    ) : revealed && selected && !correct ? (
                      <X size={18} />
                    ) : (
                      letter
                    )}
                  </span>
                  <span>{option}</span>
                  {selected && !revealed && (
                    <span className="option-selected-dot" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-answer-area">
            <label htmlFor="user-answer">
              {question.type === "简答题" ? "写下你的回答" : "填写答案"}
            </label>
            <textarea
              id="user-answer"
              value={draft}
              rows={question.type === "简答题" ? 7 : 3}
              placeholder={
                question.type === "简答题"
                  ? "先在脑中组织答案，再对照参考答案自评..."
                  : "请输入答案..."
              }
              disabled={revealed}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
        )}

        {savingError && <p className="form-error">{savingError}</p>}

        {revealed && (
          <section
            className={`answer-result ${
              currentAttempt?.result === "correct"
                ? "result-correct"
                : currentAttempt?.result === "incorrect"
                  ? "result-wrong"
                  : "result-review"
            }`}
          >
            <div className="answer-result-title">
              {currentAttempt?.result === "correct" ? (
                <CheckCircle2 size={22} />
              ) : currentAttempt?.result === "incorrect" ? (
                <XCircle size={22} />
              ) : (
                <Lightbulb size={22} />
              )}
              <strong>
                {currentAttempt?.result === "correct"
                  ? "回答正确"
                  : currentAttempt?.result === "incorrect"
                    ? "需要再巩固"
                    : suggestedCorrect
                      ? "与参考答案基本一致"
                      : "请对照参考答案判断"}
              </strong>
            </div>
            <div className="reference-answer">
              <span>参考答案</span>
              <p>{question.answer}</p>
            </div>
            <div className="reference-policy">
              <span>参考制度</span>
              <p>{question.reference || "题库未提供参考制度"}</p>
            </div>
            {needsSelfAssessment && (
              <div className="self-assess-row">
                <p>主观题不做自动判分，请根据作答情况选择：</p>
                <div>
                  <button
                    className="button button-success"
                    type="button"
                    disabled={saving}
                    onClick={() => saveSelfAssessment("correct")}
                  >
                    <Check size={17} />
                    已掌握
                  </button>
                  <button
                    className="button button-danger-ghost"
                    type="button"
                    disabled={saving}
                    onClick={() => saveSelfAssessment("incorrect")}
                  >
                    <X size={17} />
                    还需复习
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="question-footer">
          <span>
            {revealed
              ? currentAttempt
                ? "本题答案已保存到本机"
                : "完成自评后才会写入记录"
              : "答案与制度引用将在提交后显示"}
          </span>
          {!revealed ? (
            <button
              className="button button-dark"
              type="button"
              disabled={saving}
              onClick={submitAnswer}
            >
              {saving ? "保存中..." : "查看答案"}
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              className="button button-dark"
              type="button"
              disabled={saving || !currentAttempt}
              onClick={nextQuestion}
            >
              {index >= sessionQuestions.length - 1 ? "完成练习" : "下一题"}
              <ArrowRight size={17} />
            </button>
          )}
        </footer>
      </article>

      <button className="quiz-back-link" type="button" onClick={onExit}>
        <ChevronLeft size={16} />
        先退出，进度会自动保留
      </button>
    </div>
  );
}
