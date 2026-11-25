// Conversions between datetime-local inputs, ISO strings and display parts.
const pad = (n: number) => String(n).padStart(2, "0");

// <input type="datetime-local"> value ("YYYY-MM-DDTHH:mm", parsed as local time) -> UTC ISO 8601, which the API
// schema accepts. Returns null for empty/invalid input.
export function localInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ISO string -> datetime-local value in the viewer's timezone. Returns "" for invalid input.
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type DateParts = {
  weekday: string;
  day: string;
  month: string;
  year: string | null;
  time: string;
};

// Pieces of the date block on a consultation row. The year is only given when it is not the current one.
// locale and timeZone default to the viewer's; the server passes UTC so its render is deterministic.
export function dateParts(
  iso: string,
  { locale, timeZone, now = new Date() }: { locale?: string; timeZone?: string; now?: Date } = {},
): DateParts | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = (opts: Intl.DateTimeFormatOptions, date = d) =>
    new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(date);
  const year = fmt({ year: "numeric" });
  return {
    weekday: fmt({ weekday: "short" }),
    day: fmt({ day: "numeric" }),
    month: fmt({ month: "short" }),
    year: year === fmt({ year: "numeric" }, now) ? null : year,
    time: fmt({ timeStyle: "short" }),
  };
}
