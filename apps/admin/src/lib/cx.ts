/**
 * Join class names WITHOUT tailwind-merge. `cn()` from @one/ui runs twMerge with the default config,
 * which treats the preset's custom font sizes (text-small, text-micro…) as colors and drops them
 * when a text color is also present — so app code uses this plain join instead.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
