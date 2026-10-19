"use client";
import { forwardRef } from "react";
import { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "@one/ui";
import { cx } from "@/lib/cx";

/*
 * Workaround: @one/ui Button merges classes with tailwind-merge, which treats the size token
 * (text-h2 / text-body) and the variant color (text-on-brand / text-ink) as conflicting and drops
 * the color. We pass the color via className (it wins the merge) and re-apply the size on a span.
 */
const COLOR: Record<ButtonVariant, string> = {
  primary: "text-on-brand",
  secondary: "text-ink",
  ghost: "text-ink",
  danger: "text-status-failed-fg",
};
const TEXT: Record<ButtonSize, string> = { sm: "text-small", md: "text-body", lg: "text-body", xl: "text-h2" };

export const AppButton = forwardRef<HTMLButtonElement, ButtonProps>(function AppButton(
  { variant = "primary", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size={size} className={cx(COLOR[variant], className)} {...rest}>
      <span className={cx("inline-flex items-center gap-2", TEXT[size])}>{children}</span>
    </Button>
  );
});
