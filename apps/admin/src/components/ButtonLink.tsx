import { cx } from "@/lib/cx";
import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";


const VARIANTS = {
  primary: "bg-brand text-on-brand hover:brightness-95",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-sunk",
  ghost: "bg-transparent text-ink hover:bg-surface-sunk",
} as const;
const SIZES = { sm: "h-9 px-3 text-small", md: "h-11 px-4 text-body", lg: "h-12 px-5 text-body" } as const;

/** A link styled like `Button` (avoids nesting <button> inside <a>). External/new-tab links use a plain <a>. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  external = false,
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  external?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  const cls = cx(
    "inline-flex select-none items-center justify-center gap-2 rounded-md font-semibold transition",
    "focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
