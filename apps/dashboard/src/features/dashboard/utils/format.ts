/** Locale-stable clock for SSR + client (avoids AM/PM vs 24h hydration mismatch). */
export function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
