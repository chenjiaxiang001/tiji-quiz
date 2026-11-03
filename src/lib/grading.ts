import type { AttemptResult, Question } from "../types";
import { answerLetters, normalizeForComparison } from "./utils";

export interface GradeResult {
  automatic: boolean;
  result?: AttemptResult;
  suggestedCorrect?: boolean;
}

export function gradeAnswer(
  question: Question,
  userAnswer: string
): GradeResult {
  if (question.type === "单选题") {
    return {
      automatic: true,
      result:
        userAnswer.trim().toUpperCase() === question.answer.trim().toUpperCase()
          ? "correct"
          : "incorrect"
    };
  }

  if (question.type === "多选题") {
    return {
      automatic: true,
      result:
        answerLetters(userAnswer) === answerLetters(question.answer)
          ? "correct"
          : "incorrect"
    };
  }

  return {
    automatic: false,
    suggestedCorrect:
      normalizeForComparison(userAnswer) === normalizeForComparison(question.answer)
  };
}

export function isAnswerEmpty(question: Question, answer: string): boolean {
  if (question.type === "填空题" || question.type === "简答题") {
    return answer.trim().length === 0;
  }
  return answerLetters(answer).length === 0;
}
