"use client";

import { useMounted } from "@/hooks/use-mounted";

// The server has no idea of the viewer's timezone: it renders UTC, and the browser re-renders in its own locale
// after hydration (useMounted is false during hydration, so there is no mismatch).
export function LocalDateTime({ iso }: { iso: string }) {
  const mounted = useMounted();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span>Invalid date</span>;
  const text = mounted
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d)
    : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  return <time dateTime={iso}>{text}</time>;
}
