"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:brightness-95 active:brightness-90",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-sunk",
  ghost: "bg-transparent text-ink hover:bg-surface-sunk",
  danger: "bg-status-failed text-status-failed-fg border border-status-failed-fg/30 hover:brightness-95",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-small rounded-md",
  md: "h-11 px-4 text-body rounded-md",
  lg: "h-12 px-5 text-body rounded-md",
  xl: "h-16 px-6 text-h2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, block = false, className, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition",
        "focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
