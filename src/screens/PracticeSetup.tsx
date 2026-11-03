import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  ListOrdered,
  Play,
  Shuffle,
  Sparkles
} from "lucide-react";
import type { PracticeMode, Question, QuestionBank, QuestionType } from "../types";
import { QUESTION_TYPES } from "../types";
import { TYPE_META, activeWrongQuestionIds } from "../lib/utils";
import { TypeBadge } from "../components/ui";

type SelectableType = QuestionType | "all";

export function PracticeSetup({
  bank,
  questions,
  wrongItems,
  initialType = "all",
  onStart
}: {
  bank: QuestionBank;
  questions: Question[];
  wrongItems: Parameters<typeof activeWrongQuestionIds>[0];
  initialType?: SelectableType;
  onStart: (type: SelectableType, mode: PracticeMode, count: number) => void;
}) {
  const [type, setType] = useState<SelectableType>(initialType);
  const [mode, setMode] = useState<PracticeMode>("random");
  const [countChoice, setCountChoice] = useState(20);
  const wrongIds = activeWrongQuestionIds(wrongItems, bank.id);
  const available = useMemo(() => {
    const scoped =
      type === "all"
        ? questions
        : questions.filter((question) => question.type === type);
    return mode === "wrong"
      ? scoped.filter((question) => wrongIds.has(question.id))
      : scoped;
  }, [mode, questions, type, wrongIds]);

  const selectedCount =
    mode === "wrong"
      ? available.length
      : countChoice === 0
        ? available.length
        : Math.min(countChoice, available.length);
  const canStart = selectedCount > 0;

  return (
    <div className="page practice-setup-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} />
            定制一组练习
          </p>
          <h1>今天想怎么练？</h1>
          <p>选择题型、顺序与题量，答案会在提交后统一呈现。</p>
        </div>
        <span className="question-total">{bank.questionCount} 道题可用</span>
      </header>

      <div className="setup-layout">
        <div className="setup-main">
          <section className="setup-section">
            <div className="setup-title">
              <span>01</span>
              <div>
                <h2>选择题型</h2>
                <p>当前题库 {bank.name}</p>
              </div>
            </div>
            <div className="choice-type-grid">
              <button
                type="button"
                className={`choice-type choice-all ${type === "all" ? "selected" : ""}`}
                onClick={() => setType("all")}
              >
                <span className="choice-check">
                  {type === "all" && <CheckCircle2 size={17} />}
                </span>
                <strong>全部题型</strong>
                <small>{bank.questionCount} 道</small>
              </button>
              {QUESTION_TYPES.map((item) => {
                const meta = TYPE_META[item];
                return (
                  <button
                    type="button"
                    key={item}
                    className={`choice-type choice-${meta.color} ${type === item ? "selected" : ""}`}
                    onClick={() => setType(item)}
                  >
                    <span className="choice-check">
                      {type === item && <CheckCircle2 size={17} />}
                    </span>
                    <strong>{item}</strong>
                    <small>{bank.breakdown[item]} 道</small>
                    <span className="choice-desc">{meta.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="setup-section">
            <div className="setup-title">
              <span>02</span>
              <div>
                <h2>选择练习方式</h2>
                <p>随机练习更适合检验真实掌握情况。</p>
              </div>
            </div>
            <div className="mode-grid">
              <button
                type="button"
                className={mode === "random" ? "mode-card selected" : "mode-card"}
                onClick={() => setMode("random")}
              >
                <Shuffle size={22} />
                <strong>随机练习</strong>
                <span>打乱题目顺序，避免只记住位置。</span>
              </button>
              <button
                type="button"
                className={mode === "sequence" ? "mode-card selected" : "mode-card"}
                onClick={() => setMode("sequence")}
              >
                <ListOrdered size={22} />
                <strong>顺序练习</strong>
                <span>按照题库原始序号依次作答。</span>
              </button>
              <button
                type="button"
                className={mode === "wrong" ? "mode-card selected" : "mode-card"}
                onClick={() => setMode("wrong")}
                disabled={
                  activeWrongQuestionIds(wrongItems, bank.id).size === 0
                }
              >
                <CircleHelp size={22} />
                <strong>错题重练</strong>
                <span>
                  {wrongIds.size ? `当前 ${wrongIds.size} 道待复习` : "暂无待复习错题"}
                </span>
              </button>
            </div>
          </section>

          <section className="setup-section">
            <div className="setup-title">
              <span>03</span>
              <div>
                <h2>选择题量</h2>
                <p>错题重练会自动包含当前筛选下的全部错题。</p>
              </div>
            </div>
            <div className="count-row">
              {[10, 20, 50, 0].map((item) => (
                <button
                  type="button"
                  key={item}
                  className={countChoice === item ? "count-option selected" : "count-option"}
                  disabled={mode === "wrong"}
                  onClick={() => setCountChoice(item)}
                >
                  <strong>{item || "全部"}</strong>
                  {item > 0 && <span>道</span>}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="practice-summary">
          <p className="eyebrow light">本组练习</p>
          <div className="summary-type">
            {type === "all" ? (
              <span className="type-badge type-green">全部题型</span>
            ) : (
              <TypeBadge type={type} />
            )}
          </div>
          <div className="summary-count">
            <strong>{selectedCount}</strong>
            <span>道题</span>
          </div>
          <ul>
            <li>
              <span>练习方式</span>
              <strong>
                {mode === "random"
                  ? "随机顺序"
                  : mode === "sequence"
                    ? "题库顺序"
                    : "错题优先"}
              </strong>
            </li>
            <li>
              <span>自动判分</span>
              <strong>单选 / 多选</strong>
            </li>
            <li>
              <span>主观题</span>
              <strong>参考答案自评</strong>
            </li>
          </ul>
          <button
            type="button"
            className="button button-accent button-wide"
            disabled={!canStart}
            onClick={() => onStart(type, mode, selectedCount)}
          >
            <Play size={17} fill="currentColor" />
            开始练习
            <ArrowRight size={17} />
          </button>
          <p className="summary-note">
            练习进度会自动保存在本机，离开后可以继续。
          </p>
        </aside>
      </div>
    </div>
  );
}
