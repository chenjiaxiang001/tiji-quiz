import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseQuestionWorkbook } from "../importer";
import seed from "../../data/seed.json";

describe("parseQuestionWorkbook", () => {
  it("imports the supplied 252-question workbook", () => {
    const file = readFileSync("E:/test/人力题库.xlsx");
    const arrayBuffer = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength
    ) as ArrayBuffer;
    const preview = parseQuestionWorkbook(arrayBuffer, "人力题库.xlsx");

    expect(preview.errors).toEqual([]);
    expect(preview.bank.questionCount).toBe(252);
    expect(preview.bank.breakdown).toEqual({
      单选题: 120,
      多选题: 60,
      填空题: 60,
      简答题: 12
    });
    expect(preview.warnings).toHaveLength(3);
    expect(new Set(preview.questions.map((question) => question.id)).size).toBe(
      252
    );
    expect(preview.questions[0]).toMatchObject({
      type: "单选题",
      sequence: 1,
      answer: "A"
    });
    const importedShape = preview.questions.map(
      ({ type, sequence, stem, options, answer, reference }) => ({
        type,
        sequence,
        stem,
        options,
        answer,
        reference
      })
    );
    const seedShape = seed.questions.map(
      ({ type, sequence, stem, options, answer, reference }) => ({
        type,
        sequence,
        stem,
        options,
        answer,
        reference
      })
    );
    const mismatchIndex = importedShape.findIndex(
      (value, index) =>
        JSON.stringify(value) !== JSON.stringify(seedShape[index])
    );
    expect({
      mismatchIndex,
      imported: importedShape[mismatchIndex],
      seed: seedShape[mismatchIndex]
    }).toEqual({
      mismatchIndex: -1,
      imported: undefined,
      seed: undefined
    });
    expect(preview.bank.contentHash).toBe(seed.bank.contentHash);
  });
});
