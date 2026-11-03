import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  HardDriveDownload,
  Info,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  WifiOff
} from "lucide-react";
import type { AppBackup, ImportPreview, QuestionBank } from "../types";
import {
  addQuestionBank,
  deleteAllPracticeData,
  exportBackup,
  restoreBackup,
  setActiveBank
} from "../lib/db";
import { parseQuestionFile } from "../lib/importer";
import { formatDate } from "../lib/utils";
import { Modal } from "../components/ui";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function downloadFile(content: BlobPart, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BankData({
  banks,
  activeBankId,
  onRefresh,
  onToast
}: {
  banks: QuestionBank[];
  activeBankId: string;
  onRefresh: () => Promise<void>;
  onToast: (
    message: string,
    type?: "success" | "error" | "info"
  ) => void;
}) {
  const excelInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);

  async function handleExcel(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = await parseQuestionFile(file);
      setPreview(parsed);
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "读取题库失败",
        "error"
      );
    } finally {
      if (excelInput.current) excelInput.current.value = "";
    }
  }

  async function confirmImport() {
    if (!preview || preview.errors.length) return;
    setImporting(true);
    try {
      const bank = await addQuestionBank(preview);
      await onRefresh();
      setPreview(null);
      onToast(
        bank.id === preview.bank.id
          ? `已导入 ${preview.bank.questionCount} 道题`
          : "题库内容已存在，已直接切换到该版本",
        "success"
      );
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "导入失败",
        "error"
      );
    } finally {
      setImporting(false);
    }
  }

  async function activate(bankId: string) {
    setBusy(true);
    try {
      await setActiveBank(bankId);
      await onRefresh();
      onToast("已切换当前题库");
    } catch {
      onToast("切换题库失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleBackup() {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(
        JSON.stringify(backup, null, 2),
        `题迹备份-${date}.json`,
        "application/json"
      );
      onToast("备份文件已导出");
    } catch {
      onToast("导出备份失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore(file: File | undefined) {
    if (!file) return;
    if (
      !window.confirm(
        "恢复备份会覆盖本机当前的全部题库、练习记录和错题状态。确定继续吗？"
      )
    ) {
      if (backupInput.current) backupInput.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as AppBackup;
      await restoreBackup(parsed);
      await onRefresh();
      onToast("备份已恢复");
    } catch (error) {
      onToast(
        error instanceof Error ? error.message : "恢复备份失败",
        "error"
      );
    } finally {
      setBusy(false);
      if (backupInput.current) backupInput.current.value = "";
    }
  }

  async function clearPractice() {
    if (
      !window.confirm(
        "确定清除全部练习记录和错题状态吗？题库会保留，此操作无法撤销。"
      )
    ) {
      return;
    }
    const secondConfirm = window.confirm(
      "这是最后一次确认。建议先导出备份，仍要清除全部记录吗？"
    );
    if (!secondConfirm) return;
    setBusy(true);
    try {
      await deleteAllPracticeData();
      await onRefresh();
      onToast("练习记录和错题状态已清除");
    } catch {
      onToast("清除记录失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      onToast("请使用浏览器菜单中的“安装应用”或“添加到主屏幕”", "info");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      onToast("安装请求已提交");
    }
  }

  return (
    <div className="page bank-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Database size={15} />
            题库版本与本机数据
          </p>
          <h1>题库与数据</h1>
          <p>切换题库不会覆盖旧记录；导入新版时请保留原来的题库版本。</p>
        </div>
        <button
          type="button"
          className="button button-dark"
          onClick={() => excelInput.current?.click()}
        >
          <Upload size={17} />
          导入题库
        </button>
        <input
          ref={excelInput}
          className="visually-hidden"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => handleExcel(event.target.files?.[0])}
        />
      </header>

      <div className="bank-layout">
        <section className="bank-list-section">
          <div className="card-heading">
            <div>
              <h2>我的题库</h2>
              <p>当前共有 {banks.length} 个题库版本，记录分别绑定到对应版本。</p>
            </div>
          </div>
          <div className="bank-list">
            {banks.map((bank) => {
              const active = bank.id === activeBankId;
              return (
                <article className={`bank-card ${active ? "active" : ""}`} key={bank.id}>
                  <div className="bank-icon">
                    <FileSpreadsheet size={25} />
                  </div>
                  <div className="bank-main">
                    <div className="bank-title">
                      <h3>{bank.name}</h3>
                      {bank.builtIn && <span className="mini-tag">内置</span>}
                      {active && (
                        <span className="active-tag">
                          <CheckCircle2 size={13} />
                          当前使用
                        </span>
                      )}
                    </div>
                    <p>
                      {bank.questionCount} 道题 · 导入于{" "}
                      {formatDate(bank.importedAt, false)}
                    </p>
                    <div className="bank-breakdown">
                      <span>单选 {bank.breakdown["单选题"]}</span>
                      <span>多选 {bank.breakdown["多选题"]}</span>
                      <span>填空 {bank.breakdown["填空题"]}</span>
                      <span>简答 {bank.breakdown["简答题"]}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`button button-small ${active ? "button-muted" : "button-dark"}`}
                    disabled={active || busy}
                    onClick={() => activate(bank.id)}
                  >
                    {active ? "使用中" : "切换使用"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="data-side">
          <article className="data-card install-card">
            <span className="data-card-icon">
              <MonitorSmartphone size={23} />
            </span>
            <h2>安装到设备</h2>
            <p>安装后可像普通应用一样从桌面或主屏幕启动，断网也能继续刷题。</p>
            <button
              className="button button-accent button-wide"
              type="button"
              onClick={installApp}
            >
              <Download size={17} />
              安装应用
            </button>
            <div className="install-tips">
              <span>
                <WifiOff size={15} />
                首次加载后支持离线
              </span>
              <span>
                <Smartphone size={15} />
                iPhone 可在 Safari 分享菜单中添加
              </span>
            </div>
          </article>

          <article className="data-card">
            <span className="data-card-icon">
              <ShieldCheck size={23} />
            </span>
            <h2>数据在本机</h2>
            <p>
              题目、练习记录和错题状态保存在当前浏览器。清除网站数据或卸载应用前，请先导出备份。
            </p>
            <div className="data-actions">
              <button
                className="button button-dark button-wide"
                type="button"
                disabled={busy}
                onClick={handleBackup}
              >
                <HardDriveDownload size={17} />
                导出完整备份
              </button>
              <button
                className="button button-outline button-wide"
                type="button"
                disabled={busy}
                onClick={() => backupInput.current?.click()}
              >
                <RefreshCw size={17} />
                从备份恢复
              </button>
              <input
                ref={backupInput}
                className="visually-hidden"
                type="file"
                accept=".json,application/json"
                onChange={(event) => handleRestore(event.target.files?.[0])}
              />
            </div>
            <p className="data-note">
              备份是 JSON 文件，包含所有题库和记录，可复制到电脑或手机保存。
            </p>
          </article>

          <article className="data-card danger-card">
            <h2>清除练习数据</h2>
            <p>只清除刷题批次、作答历史和错题状态，不改动已导入的题库。</p>
            <button
              className="button button-danger-ghost button-wide"
              type="button"
              disabled={busy}
              onClick={clearPractice}
            >
              <Trash2 size={16} />
              清除全部练习记录
            </button>
          </article>
        </aside>
      </div>

      <Modal
        open={Boolean(preview)}
        title="确认导入题库"
        onClose={() => !importing && setPreview(null)}
        width="760px"
      >
        {preview && (
          <div className="import-preview">
            <label className="field-label" htmlFor="bank-name">
              题库名称
            </label>
            <input
              id="bank-name"
              className="text-field"
              value={preview.bank.name}
              onChange={(event) =>
                setPreview({
                  ...preview,
                  bank: { ...preview.bank, name: event.target.value }
                })
              }
            />
            <div className="import-file-row">
              <FileSpreadsheet size={20} />
              <span>{preview.bank.sourceFile}</span>
              <strong>{preview.bank.questionCount} 道题</strong>
            </div>
            <div className="import-counts">
              {Object.entries(preview.bank.breakdown).map(([type, count]) => (
                <div key={type}>
                  <strong>{count}</strong>
                  <span>{type}</span>
                </div>
              ))}
            </div>
            {preview.errors.length > 0 && (
              <div className="import-message import-error">
                <AlertTriangle size={19} />
                <div>
                  <strong>发现 {preview.errors.length} 个问题，暂不能导入</strong>
                  <ul>
                    {preview.errors.slice(0, 8).map((error, index) => (
                      <li key={`${error.row}-${index}`}>
                        第 {error.row} 行：{error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div className="import-message import-warning">
                <Info size={19} />
                <div>
                  <strong>有 {preview.warnings.length} 条提醒</strong>
                  <p>
                    主要是参考制度为空，不影响导入。练习时仍会显示参考答案。
                  </p>
                </div>
              </div>
            )}
            {preview.errors.length === 0 && preview.warnings.length === 0 && (
              <div className="import-message import-success">
                <CheckCircle2 size={19} />
                <div>
                  <strong>题库校验通过</strong>
                  <p>题目、选项和答案字段均符合导入要求。</p>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button
                className="button button-outline"
                type="button"
                disabled={importing}
                onClick={() => setPreview(null)}
              >
                取消
              </button>
              <button
                className="button button-dark"
                type="button"
                disabled={importing || preview.errors.length > 0 || !preview.bank.name.trim()}
                onClick={confirmImport}
              >
                {importing ? "正在导入..." : "确认导入"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
