import * as XLSX from "xlsx";
import {
  QUESTION_TYPES,
  type ImportError,
  type ImportPreview,
  type Question,
  type QuestionBank,
  type QuestionType
} from "../types";

const REQUIRED_HEADERS = ["题型", "序号", "题目", "正确答案"];
const OPTIONAL_OPTION_HEADERS = ["选项1", "选项2", "选项3", "选项4", "选项5"];

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

function text(value: Cell): string {
  return value == null ? "" : String(value).trim();
}

function normalizeHeader(value: Cell): string {
  return text(value).replace(/\s+/g, "").replace(/^\uFEFF/, "");
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cleanSheetRows(rawRows: Cell[][]): {
  headers: string[];
  rows: Row[];
} | null {
  const headerIndex = rawRows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    return REQUIRED_HEADERS.every((header) => normalized.includes(header));
  });
  if (headerIndex < 0) return null;

  const headers = rawRows[headerIndex].map(normalizeHeader);
  const rows = rawRows.slice(headerIndex + 1).map((row) => {
    const record: Row = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index];
    });
    return record;
  });
  return { headers, rows };
}

function findQuestionRows(fileBuffer: ArrayBuffer): {
  sheetName: string;
  rows: Row[];
} {
  const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: false });

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Cell[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false
    });
    const cleaned = cleanSheetRows(rawRows);
    if (cleaned) {
      return {
        sheetName,
        rows: cleaned.rows.filter((row) =>
          Object.values(row).some((value) => text(value) !== "")
        )
      };
    }
  }

  throw new Error(
    "未找到题库工作表。请确认工作表包含“题型、序号、题目、正确答案”四列。"
  );
}

function parseOptions(row: Row): string[] {
  return OPTIONAL_OPTION_HEADERS.map((header) => text(row[header])).filter(Boolean).map((value, index) => {
    const letter = String.fromCharCode(65 + index);
    return value.replace(
      new RegExp(`^${letter}\\s*[、.．:：]\\s*`, "i"),
      ""
    );
  });
}

function isValidType(value: string): value is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(value);
}

function sourceName(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls|csv)$/i, "") || "新题库";
}

export function parseQuestionWorkbook(
  fileBuffer: ArrayBuffer,
  fileName: string
): ImportPreview {
  const { sheetName, rows } = findQuestionRows(fileBuffer);
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  const questionsDraft: Omit<Question, "id" | "bankId">[] = [];
  const sourceKeys = new Set<string>();
  const stems = new Set<string>();

  rows.forEach((row, index) => {
    const sourceRow = index + 2;
    const type = text(row["题型"]);
    const sequenceText = text(row["序号"]);
    const sequence = Number(sequenceText);
    const stem = text(row["题目"]);
    const answer = text(row["正确答案"]);
    const reference = text(row["参考制度"]);
    const options = parseOptions(row);

    if (!isValidType(type)) {
      errors.push({
        row: sourceRow,
        message: `题型“${type || "空"}”无法识别`
      });
      return;
    }
    if (!sequenceText || !Number.isInteger(sequence) || sequence <= 0) {
      errors.push({ row: sourceRow, message: "序号必须为正整数" });
      return;
    }
    if (!stem) {
      errors.push({ row: sourceRow, message: "题目不能为空" });
      return;
    }
    if (!answer) {
      errors.push({ row: sourceRow, message: "正确答案不能为空" });
      return;
    }

    const sourceKey = `${type}:${sequence}`;
    if (sourceKeys.has(sourceKey)) {
      errors.push({
        row: sourceRow,
        message: `同一题型内序号 ${sequence} 重复`
      });
      return;
    }
    sourceKeys.add(sourceKey);

    const normalizedStem = stem.toLowerCase().replace(/\s+/g, "");
    if (stems.has(normalizedStem)) {
      errors.push({ row: sourceRow, message: "题目内容重复" });
      return;
    }
    stems.add(normalizedStem);

    if (type === "单选题" || type === "多选题") {
      if (options.length < 2) {
        errors.push({ row: sourceRow, message: "客观题至少需要两个选项" });
        return;
      }
      const letters = new Set(
        answer
          .toUpperCase()
          .replace(/[^A-E]/g, "")
          .split("")
      );
      const maxLetter = String.fromCharCode(64 + options.length);
      const outOfRange = [...letters].some((letter) => letter > maxLetter);
      if (!letters.size || outOfRange) {
        errors.push({
          row: sourceRow,
          message: `答案“${answer}”包含不存在的选项`
        });
        return;
      }
      if (type === "单选题" && letters.size !== 1) {
        errors.push({
          row: sourceRow,
          message: `单选题答案“${answer}”不是单个选项`
        });
        return;
      }
    }

    if (!reference) {
      warnings.push(`第 ${sourceRow} 行“参考制度”为空，练习时仍可显示题目和答案。`);
    }

    questionsDraft.push({
      type,
      sequence,
      stem,
      options,
      answer,
      reference,
      sourceRow,
      fingerprint: simpleHash(
        JSON.stringify({ type, sequence, stem, options, answer })
      )
    });
  });

  if (!questionsDraft.length) {
    errors.push({ row: 1, message: "题库中没有可导入的题目" });
  }

  const contentHash = simpleHash(
    JSON.stringify(
      questionsDraft.map(({ type, sequence, stem, options, answer, reference }) => ({
        type,
        sequence,
        stem,
        options,
        answer,
        reference
      }))
    )
  );
  const bankId = `import-${contentHash}`;
  const breakdown = Object.fromEntries(
    QUESTION_TYPES.map((type) => [type, 0])
  ) as Record<QuestionType, number>;
  for (const question of questionsDraft) {
    breakdown[question.type] += 1;
  }

  const bank: QuestionBank = {
    id: bankId,
    name: sheetName || sourceName(fileName),
    sourceFile: fileName,
    importedAt: new Date().toISOString(),
    questionCount: questionsDraft.length,
    contentHash,
    builtIn: false,
    breakdown
  };
  const questions: Question[] = questionsDraft.map((question) => ({
    ...question,
    id: `${bankId}:${question.type}:${question.sequence}`,
    bankId
  }));

  return { bank, questions, warnings, errors };
}

export async function parseQuestionFile(file: File): Promise<ImportPreview> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
    throw new Error("请选择 .xlsx、.xls 或 .csv 格式的题库文件。");
  }
  const buffer = await file.arrayBuffer();
  return parseQuestionWorkbook(buffer, file.name);
}

export { simpleHash };
