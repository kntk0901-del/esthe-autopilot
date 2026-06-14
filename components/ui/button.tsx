import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "border-[#d9654f] bg-[#d9654f] text-white hover:border-[#a84534] hover:bg-[#a84534]",
        variant === "secondary" &&
          "border-[#d7d2c8] bg-white text-[#17202a] hover:border-[#a9a39a] hover:bg-[#faf8f4]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[#56605c] hover:bg-[#ede9e1] hover:text-[#17202a]",
        variant === "danger" &&
          "border-[#cf5a4a] bg-white text-[#b34839] hover:bg-[#fff1ee]",
        className,
      )}
      {...props}
    />
  );
}
