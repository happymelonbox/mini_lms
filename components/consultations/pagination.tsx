import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Keyset navigation: no totals, so only Earlier / Later. A null cursor means there is nothing that way.
export function Pagination({
  basePath,
  prevCursor,
  nextCursor,
}: {
  basePath: string;
  prevCursor: string | null;
  nextCursor: string | null;
}) {
  const earlier = (
    <>
      <ChevronLeft aria-hidden />
      Earlier
    </>
  );
  const later = (
    <>
      Later
      <ChevronRight aria-hidden />
    </>
  );
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      {prevCursor ? (
        <Button asChild variant="outline" className="pl-3">
          <Link href={`${basePath}?before=${prevCursor}`}>{earlier}</Link>
        </Button>
      ) : (
        <Button variant="outline" className="pl-3" disabled>
          {earlier}
        </Button>
      )}
      {nextCursor ? (
        <Button asChild variant="outline" className="pr-3">
          <Link href={`${basePath}?after=${nextCursor}`}>{later}</Link>
        </Button>
      ) : (
        <Button variant="outline" className="pr-3" disabled>
          {later}
        </Button>
      )}
    </nav>
  );
}
