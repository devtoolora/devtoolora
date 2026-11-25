export function withWarning(summary: string, warning: string | undefined): string {
  return warning ? `${summary} · ${warning}` : summary;
}
