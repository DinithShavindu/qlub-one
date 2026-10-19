/**
 * Plain class joiner. We deliberately don't use `cn` (tailwind-merge) from @one/ui inside this app:
 * its default config can't tell custom font-size tokens (text-h2, text-display-kds) from color tokens
 * (text-ink, text-on-brand) and silently drops one of them.
 */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
