import type { ReactNode } from "react";
import {
  BookOpenCheck,
  CircleHelp,
  Database,
  History,
  LayoutDashboard,
  ShieldCheck
} from "lucide-react";

export type Screen =
  | "dashboard"
  | "practice"
  | "wrong"
  | "history"
  | "banks"
  | "quiz";

const NAV_ITEMS: Array<{
  id: Exclude<Screen, "quiz">;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "学习首页", icon: LayoutDashboard },
  { id: "practice", label: "开始刷题", icon: BookOpenCheck },
  { id: "wrong", label: "错题本", icon: CircleHelp },
  { id: "history", label: "练习记录", icon: History },
  { id: "banks", label: "题库与数据", icon: Database }
];

export function Layout({
  screen,
  onNavigate,
  bankName,
  children
}: {
  screen: Screen;
  onNavigate: (screen: Exclude<Screen, "quiz">) => void;
  bankName: string;
  children: ReactNode;
}) {
  const activeScreen = screen === "quiz" ? "practice" : screen;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate("dashboard")}
          aria-label="返回学习首页"
        >
          <span className="brand-mark">题</span>
          <span>
            <strong>题迹</strong>
            <small>把每一次练习留下</small>
          </span>
        </button>

        <nav className="desktop-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeScreen === item.id ? "active" : ""}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {activeScreen === item.id && <i aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="local-status">
            <ShieldCheck size={18} />
            <div>
              <strong>仅保存在本机</strong>
              <span>不联网，也不会上传记录</span>
            </div>
          </div>
          <p className="current-bank" title={bankName}>
            当前题库
            <span>{bankName}</span>
          </p>
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <nav className="mobile-nav" aria-label="移动端导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.id}
              className={activeScreen === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{item.label.replace("学习", "").replace("练习", "")}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
