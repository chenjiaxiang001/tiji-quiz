import { describe, expect, it } from "vitest";
import { gradeAnswer, isAnswerEmpty } from "../grading";
import type { Question } from "../../types";

function question(overrides: Partial<Question>): Question {
  return {
    id: "q-1",
    bankId: "bank-1",
    type: "单选题",
    sequence: 1,
    stem: "题干",
    options: ["甲", "乙"],
    answer: "A",
    reference: "制度",
    sourceRow: 2,
    fingerprint: "abc",
    ...overrides
  };
}

describe("gradeAnswer", () => {
  it("grades single choice automatically", () => {
    expect(gradeAnswer(question({}), "a")).toEqual({
      automatic: true,
      result: "correct"
    });
    expect(gradeAnswer(question({}), "B")).toEqual({
      automatic: true,
      result: "incorrect"
    });
  });

  it("compares multi-choice answers as a set", () => {
    const multi = question({ type: "多选题", answer: "AC" });
    expect(gradeAnswer(multi, "C,A").result).toBe("correct");
    expect(gradeAnswer(multi, "AB").result).toBe("incorrect");
  });

  it("suggests fill-answer matches without automatically grading", () => {
    const fill = question({
      type: "填空题",
      answer: "人力资源部",
      options: []
    });
    expect(gradeAnswer(fill, " 人力资源部。 ")).toEqual({
      automatic: false,
      suggestedCorrect: true
    });
  });

  it("requires self-assessment for short answers", () => {
    const short = question({
      type: "简答题",
      answer: "需要集体决策",
      options: []
    });
    expect(gradeAnswer(short, "需要讨论").automatic).toBe(false);
    expect(gradeAnswer(short, "需要讨论").result).toBeUndefined();
  });

  it("detects an empty answer", () => {
    expect(isAnswerEmpty(question({}), "")).toBe(true);
    expect(isAnswerEmpty(question({}), " A ")).toBe(false);
  });
});
