"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChevronRight,
  FileUp,
  Gauge,
  Menu,
  MessageSquareText,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/dashboard", label: "ダッシュボード", icon: Gauge },
  { href: "/posts", label: "投稿管理", icon: MessageSquareText },
  { href: "/therapists", label: "セラピスト", icon: Users },
  { href: "/analytics", label: "売上分析", icon: BarChart3 },
  { href: "/imports", label: "売上取込", icon: FileUp },
  { href: "/jobs", label: "ジョブログ", icon: CalendarClock },
  { href: "/settings", label: "設定", icon: Settings },
];

export function AppShell({
  children,
  operationMode,
}: {
  children: React.ReactNode;
  operationMode: "mock" | "setup" | "production";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f4f1eb]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col bg-[#121c2b] text-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/5">
              <Sparkles className="h-5 w-5 text-[#ed9a88]" />
            </span>
            <span>
              <span className="block font-serif text-[15px] font-semibold tracking-wide">
                Esthe Growth
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                Autopilot PoC
              </span>
            </span>
          </Link>
          <button
            className="rounded-lg p-2 text-white/60 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="メニューを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
            Operation
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[#d9654f] text-white"
                    : "text-white/66 hover:bg-white/7 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1">{item.label}</span>
                {active ? <ChevronRight className="h-4 w-4" /> : null}
              </Link>
            );
          })}
        </nav>
        <div className="m-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f2b4a6]">
            <BriefcaseBusiness className="h-4 w-4" />
            {operationMode === "mock"
              ? "MOCK MODE"
              : operationMode === "setup"
                ? "SETUP REQUIRED"
                : "PRODUCTION"}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-white/45">
            {operationMode === "mock"
              ? "外部API未設定でも、同期・生成・投稿・分析を確認できます。"
              : operationMode === "setup"
                ? "設定画面の本番稼働チェックを完了してください。"
                : "クラウド上で自動取得と自動投稿を実行します。"}
          </p>
        </div>
      </aside>

      {open ? (
        <button
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="メニューを閉じる"
        />
      ) : null}

      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-[#f4f1eb]/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg border bg-white p-2 text-[#17202a] lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="メニューを開く"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-xs text-[#6e746f] sm:flex">
              <Building2 className="h-4 w-4" />
              3店舗統合オペレーション
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-[#2f7d6d] sm:inline-flex">
              {operationMode === "production"
                ? "本番稼働"
                : operationMode === "setup"
                  ? "設定未完了"
                  : "モック運用"}
            </span>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#1d2a3c] text-xs font-bold text-white">
              AD
            </div>
          </div>
        </header>
        <main className="fine-grid min-h-[calc(100vh-4rem)] px-4 py-7 md:px-8 md:py-9">
          <div className="enter mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
