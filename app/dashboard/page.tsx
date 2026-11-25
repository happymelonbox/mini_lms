// /dashboard: a student's own consultations, keyset-paginated, soonest first.
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { ConsultationItem } from "@/components/consultations/consultation-item";
import { Pagination } from "@/components/consultations/pagination";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { parseCursors } from "@/lib/consultations/list-page";
import { DEFAULT_PAGE_SIZE } from "@/lib/consultations/schema";
import { listOwnConsultations } from "@/lib/consultations/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My consultations" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string | string[]; before?: string | string[] }>;
}) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  // Next layouts don't re-run on client navigation, so pages that read data check the role close to the data.
  if (user?.role !== "student") redirect("/");
  const cursors = parseCursors(await searchParams);
  const res = await listOwnConsultations(supabase, user.id, {
    ...cursors,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const isDefault = !cursors.after && !cursors.before;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-[2rem] font-medium leading-tight tracking-tight md:text-[2.5rem]">
            My consultations
          </h1>
          <p className="mt-2 text-muted-foreground">Soonest first. Use Earlier to look back.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/book">
            <Plus aria-hidden />
            Book a consultation
          </Link>
        </Button>
      </div>
      {!res.ok ? (
        <p role="alert" className="rounded-lg border border-destructive/40 p-4 text-destructive">
          We couldn&rsquo;t load your consultations. Refresh the page, or try again in a minute.
        </p>
      ) : (
        <>
          {res.value.data.length === 0 ? (
            <div className="rounded-lg border border-dashed px-5 py-8">
              {isDefault ? (
                <>
                  <p className="font-heading text-xl">Nothing coming up yet.</p>
                  <p className="mt-1 text-muted-foreground">
                    Pick a time that suits you and it will show up here.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-heading text-xl">Nothing more this way.</p>
                  <Link
                    href="/dashboard"
                    className="mt-1 inline-block py-2 text-primary underline underline-offset-4"
                  >
                    Back to what&rsquo;s coming up
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y border-y">
              {res.value.data.map((c) => (
                <ConsultationItem key={c.id} c={c} />
              ))}
            </ul>
          )}
          <Pagination
            basePath="/dashboard"
            prevCursor={res.value.prevCursor}
            nextCursor={res.value.nextCursor}
          />
        </>
      )}
    </div>
  );
}
