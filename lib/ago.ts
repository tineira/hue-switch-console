export function minutesSince(value: string | null): number | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}

export function agoText(min: number): string {
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  return hr < 48 ? `${hr} h ago` : `${Math.round(hr / 24)} days ago`;
}

// Boards check in at start-up and then about once an hour, so allow a margin.
export const CONSOLE_QUIET_MIN = 90;
