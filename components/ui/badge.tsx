import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide",
        tone === "neutral" && "border-[#d7d2c8] bg-[#f6f3ed] text-[#626862]",
        tone === "success" && "border-[#b8d8cf] bg-[#eaf6f2] text-[#236657]",
        tone === "warning" && "border-[#e2c993] bg-[#fff7e6] text-[#8a6424]",
        tone === "danger" && "border-[#e7b6ae] bg-[#fff0ed] text-[#a33e31]",
        tone === "info" && "border-[#b8cadc] bg-[#edf4fa] text-[#365f7e]",
        className,
      )}
      {...props}
    />
  );
}
