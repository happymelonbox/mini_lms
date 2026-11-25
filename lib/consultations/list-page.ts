import { listQuerySchema, type ListQuery } from "./schema";

// Unvalidated ?after= / ?before= from the URL -> cursors; anything invalid falls back to the default view.
export function parseCursors(raw: {
  after?: string | string[];
  before?: string | string[];
}): Pick<ListQuery, "after" | "before"> {
  const r = listQuerySchema.safeParse(raw);
  return r.success ? { after: r.data.after, before: r.data.before } : {};
}
