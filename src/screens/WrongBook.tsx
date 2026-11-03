import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Play,
  RotateCcw,
  Undo2
} from "lucide-react";
import type {
  Question,
  QuestionBank,
  QuestionType,
  WrongItem,
  WrongStatus
} from "../types";
import { QUESTION_TYPES } from "../types";
import { formatDate } from "../lib/utils";
import { EmptyState, SegmentedControl, TypeBadge } from "../components/ui";

type TypeFilter = QuestionType | "all";

export function WrongBook({
  bank,
  questions,
  wrongItems,
  onPractice,
  onMark,
  onGoPractice
}: {
  bank: QuestionBank;
  questions: Question[];
  wrongItems: WrongItem[];
  onPractice: (questionIds: string[]) => void;
  onMark: (questionId: string, status: WrongStatus) => Promise<void>;
  onGoPractice: () => void;
}) {
  const [status, setStatus] = useState<WrongStatus>("active");
  const [type, setType] = useState<TypeFilter>("all");
  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const scoped = wrongItems
    .filter((item) => item.bankId === bank.id && item.status === status)
    .filter((item) => {
      if (type === "all") return true;
      return questionMap.get(item.questionId)?.type === type;
    });
  const activeCount = wrongItems.filter(
    (item) => item.bankId === bank.id && item.status === "active"
  ).length;
  const masteredCount = wrongItems.filter(
    (item) => item.bankId === bank.id && item.status === "mastered"
  ).length;

  return (
    <div className="page wrongbook-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <CircleHelp size={15} />
            把薄弱点留下来
          </p>
          <h1>错题本</h1>
          <p>
            {activeCount
              ? `还有 ${activeCount} 道题待复习，答对后会自动标记为已掌握。`
              : "当前没有待复习错题，继续保持。"}
          </p>
        </div>
        <button
          type="button"
          className="button button-dark"
          disabled={!scoped.length}
          onClick={() => onPractice(scoped.map((item) => item.questionId))}
        >
          <Play size={17} fill="currentColor" />
          练习当前列表
        </button>
      </header>

      <div className="toolbar-card">
        <SegmentedControl
          ariaLabel="错题状态"
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: `待复习 ${activeCount}` },
            { value: "mastered", label: `已掌握 ${masteredCount}` }
          ]}
        />
        <div className="chip-filter" aria-label="按题型筛选">
          <button
            type="button"
            className={type === "all" ? "active" : ""}
            onClick={() => setType("all")}
          >
            全部
          </button>
          {QUESTION_TYPES.map((item) => (
            <button
              type="button"
              key={item}
              className={type === item ? "active" : ""}
              onClick={() => setType(item)}
            >
              {item.replace("题", "")}
            </button>
          ))}
        </div>
      </div>

      {scoped.length ? (
        <div className="wrong-list">
          {scoped.map((item, index) => {
            const question = questionMap.get(item.questionId);
            if (!question) return null;
            return (
              <article className="wrong-card" key={item.id}>
                <div className="wrong-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="wrong-content">
                  <div className="wrong-meta">
                    <TypeBadge type={question.type} />
                    <span>累计答错 {item.wrongCount} 次</span>
                    <span>{formatDate(item.lastWrongAt)}</span>
                  </div>
                  <h2>{question.stem}</h2>
                  <p>
                    参考答案：<strong>{question.answer}</strong>
                  </p>
                  <small>{question.reference || "未提供参考制度"}</small>
                </div>
                <div className="wrong-actions">
                  <button
                    className="button button-small button-dark"
                    type="button"
                    onClick={() => onPractice([question.id])}
                  >
                    <RotateCcw size={15} />
                    重练本题
                  </button>
                  {status === "active" ? (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onMark(question.id, "mastered")}
                    >
                      <Check size={15} />
                      标记已掌握
                    </button>
                  ) : (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => onMark(question.id, "active")}
                    >
                      <Undo2 size={15} />
                      重新加入
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={
            status === "active" ? (
              <CheckCircle2 size={30} />
            ) : (
              <CircleHelp size={30} />
            )
          }
          title={
            status === "active"
              ? type === "all"
                ? "待复习错题已清空"
                : `暂无${type}错题`
              : "还没有已掌握记录"
          }
          description={
            status === "active"
              ? "练习中答错的客观题，或自评为“还需复习”的题目会出现在这里。"
              : "重新答对或手动标记后，错题会进入这个列表。"
          }
          action={
            status === "active" ? (
              <button className="button button-dark" type="button" onClick={onGoPractice}>
                去练习 <ArrowRight size={16} />
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
