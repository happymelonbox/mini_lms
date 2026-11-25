import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalDateTime } from "@/components/consultations/local-date-time";
import { Pagination } from "@/components/consultations/pagination";
import { StatusBadge } from "@/components/consultations/status-badge";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseCursors } from "@/lib/consultations/list-page";
import { DEFAULT_PAGE_SIZE } from "@/lib/consultations/schema";
import { listAllConsultations } from "@/lib/consultations/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "All consultations" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[]; before?: string | string[] }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  // Next layouts don't re-run on client navigation, so pages that read data check the role close to the data.
  if (user?.role !== "admin") redirect("/");
  const cursors = parseCursors(await searchParams);
  const res = await listAllConsultations(supabase, { ...cursors, pageSize: DEFAULT_PAGE_SIZE });
  const isDefault = !cursors.after && !cursors.before;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-[2rem] font-medium leading-tight tracking-tight md:text-[2.5rem]">
          All consultations
        </h1>
        <p className="mt-2 text-muted-foreground">
          Every student&rsquo;s consultations, soonest first. This view is read-only.
        </p>
      </div>
      {!res.ok ? (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-destructive">
          We couldn&rsquo;t load the consultations. Refresh the page, or try again in a minute.
        </p>
      ) : (
        <>
          {res.value.data.length === 0 ? (
            <div className="rounded-lg border border-dashed px-5 py-8">
              <p className="font-heading text-xl">
                {isDefault ? "Nothing coming up yet." : "Nothing more this way."}
              </p>
              {!isDefault && (
                <Link
                  href="/admin"
                  className="mt-1 inline-block py-2 text-primary underline underline-offset-4"
                >
                  Back to what&rsquo;s coming up
                </Link>
              )}
            </div>
          ) : (
            // Focusable and named so keyboard users can scroll it if a narrow window ever squeezes the table.
            <div
              role="region"
              aria-labelledby="consultations-caption"
              tabIndex={0}
              className="consult-table"
            >
              <table>
                <caption id="consultations-caption" className="sr-only">
                  All consultations, soonest first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Date and time</th>
                    <th scope="col">Status</th>
                    <th scope="col">Booked on</th>
                  </tr>
                </thead>
                <tbody>
                  {res.value.data.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        {c.firstName} {c.lastName}
                      </th>
                      <td data-label="Reason">
                        {/* On the span, so the stacked card's "Reason" label is not struck through. */}
                        <span
                          className={
                            c.status === "cancelled"
                              ? "text-muted-foreground line-through"
                              : undefined
                          }
                        >
                          {c.reason}
                        </span>
                      </td>
                      <td data-label="Date and time">
                        <LocalDateTime iso={c.scheduledAt} />
                      </td>
                      <td data-label="Status">
                        <span>
                          <StatusBadge status={c.status} />
                        </span>
                      </td>
                      <td data-label="Booked on" className="text-muted-foreground">
                        <LocalDateTime iso={c.createdAt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            basePath="/admin"
            prevCursor={res.value.prevCursor}
            nextCursor={res.value.nextCursor}
          />
        </>
      )}
    </div>
  );
}
