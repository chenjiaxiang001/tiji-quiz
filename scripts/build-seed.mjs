import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const args = process.argv.slice(2);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.resolve(args[0] || path.join(root, "人力题库.xlsx"));
const outputPath = path.resolve(
  args[1] || path.join(root, "src/data/seed.json")
);

function text(value) {
  return value == null ? "" : String(value).trim();
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const workbook = XLSX.readFile(inputPath, { cellDates: false });
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: null,
  raw: true
});

const bankId = "builtin-renli-2026";
const questions = rows.map((row, index) => {
  const type = text(row["题型"]);
  const sequence = Number(row["序号"]);
  const sourceRow = index + 2;
  const options = [1, 2, 3, 4, 5]
    .map((number) => text(row[`选项${number}`]))
    .filter(Boolean)
    .map((value, optionIndex) => {
      const letter = String.fromCharCode(65 + optionIndex);
      return value.replace(
        new RegExp(`^${letter}\\s*[、.．:：]\\s*`, "i"),
        ""
      );
    });
  const stem = text(row["题目"]);
  const answer = text(row["正确答案"]);

  return {
    id: `${bankId}:${type}:${sequence}`,
    bankId,
    type,
    sequence,
    stem,
    options,
    answer,
    reference: text(row["参考制度"]),
    sourceRow,
    fingerprint: simpleHash(
      JSON.stringify({ type, sequence, stem, options, answer })
    )
  };
});

const breakdown = {
  单选题: 0,
  多选题: 0,
  填空题: 0,
  简答题: 0
};
for (const question of questions) {
  breakdown[question.type] += 1;
}

const contentHash = simpleHash(
  JSON.stringify(
    questions.map(({ type, sequence, stem, options, answer, reference }) => ({
      type,
      sequence,
      stem,
      options,
      answer,
      reference
    }))
  )
);

const data = {
  bank: {
    id: bankId,
    name: sheetName,
    sourceFile: path.basename(inputPath),
    importedAt: "2026-11-03T10:03:02.000Z",
    questionCount: questions.length,
    contentHash,
    builtIn: true,
    breakdown
  },
  questions
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.log(
  `Generated ${path.relative(process.cwd(), outputPath)} with ${questions.length} questions.`
);
