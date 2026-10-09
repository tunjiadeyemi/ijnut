export function errorBadgeVariant(rate: number) {
  if (rate > 0.05) return "danger" as const;
  if (rate > 0) return "warning" as const;
  return "success" as const;
}

export function statusBadgeVariant(code: number) {
  if (code >= 500) return "danger" as const;
  if (code >= 400) return "warning" as const;
  return "success" as const;
}
