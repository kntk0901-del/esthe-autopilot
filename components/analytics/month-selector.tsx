"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// 分析対象の月を切り替えるコントロール。URL の ?month=YYYY-MM を更新して
// サーバーコンポーネント側で対象期間を再計算させる。
export function MonthSelector({
  month,
  currentMonth,
  basePath = "/analytics",
}: {
  month: string;
  currentMonth: string;
  basePath?: string;
}) {
  const router = useRouter();
  const go = (value: string) => router.push(`${basePath}?month=${value}`);
  const isCurrent = month >= currentMonth;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftMonth(month, -1))}
        className="grid h-9 w-9 place-items-center rounded-lg border bg-white text-[#435267] transition hover:bg-[#faf8f4]"
        aria-label="前の月"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="month"
        value={month}
        max={currentMonth}
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
        className="h-9 rounded-lg border bg-white px-3 text-sm font-semibold text-[#17202a]"
      />
      <button
        type="button"
        onClick={() => go(shiftMonth(month, 1))}
        disabled={isCurrent}
        className="grid h-9 w-9 place-items-center rounded-lg border bg-white text-[#435267] transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="次の月"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {!isCurrent ? (
        <button
          type="button"
          onClick={() => go(currentMonth)}
          className="ml-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-[#b64f3b] transition hover:bg-[#faf8f4]"
        >
          今月へ
        </button>
      ) : null}
    </div>
  );
}
