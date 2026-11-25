"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./status-badge";
import { patchConsultation } from "@/lib/api/client";
import { bookingFormSchema, friendlyMessage } from "@/lib/consultations/form-schema";
import type { PatchInput } from "@/lib/consultations/schema";
import type { ConsultationDto } from "@/lib/consultations/service";
import { dateParts, isoToLocalInput } from "@/lib/datetime";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

const CHIP = {
  scheduled: "bg-accent text-accent-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export function ConsultationItem({ c }: { c: ConsultationDto }) {
  const router = useRouter();
  // Mirrors the DB guard triggers, so the UI only offers what the API/DB would not reject with 409.
  const scheduled = c.status === "scheduled";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [cancelledHere, setCancelledHere] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Cancelling removes the focused controls, so once the refreshed row arrives focus moves to its heading.
  useEffect(() => {
    if (cancelledHere && c.status === "cancelled") headingRef.current?.focus();
  }, [cancelledHere, c.status]);
  // Same rule as LocalDateTime: UTC on the server and during hydration, the viewer's timezone after.
  const mounted = useMounted();
  const parts = dateParts(c.scheduledAt, mounted ? {} : { locale: "en-US", timeZone: "UTC" });

  // Returns the failure message (or null); the caller shows it once: in the dialog while open, else on the row.
  async function run(body: PatchInput) {
    setPending(true);
    setError(null);
    const res = await patchConsultation(c.id, body);
    setPending(false);
    // 404/409 mean our copy is stale: refresh so the row shows the real state.
    if (res.ok || res.status === 404 || res.status === 409) router.refresh();
    if (res.ok) return null;
    return res.error.fields?.scheduledAt?.[0] ?? res.error.message;
  }

  const runOnRow = async (body: PatchInput) => setError(await run(body));

  async function reschedule(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = bookingFormSchema.shape.scheduledAt.safeParse(when);
    if (!parsed.success) {
      setRescheduleError(friendlyMessage("scheduledAt", parsed.error.issues[0].message) ?? null);
      return;
    }
    const err = await run({ action: "reschedule", scheduledAt: parsed.data });
    if (err) setRescheduleError(friendlyMessage("scheduledAt", err) ?? null);
    else setRescheduleOpen(false);
  }

  const name = `${c.firstName} ${c.lastName}`;
  return (
    <li
      className={cn(
        "grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-4 py-5",
        "sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6",
        "lg:grid-cols-[4.5rem_minmax(0,1fr)_auto]",
      )}
    >
      <time
        dateTime={c.scheduledAt}
        className={cn(
          "flex flex-col items-center justify-center self-start rounded-lg py-2 text-center leading-tight",
          CHIP[c.status],
        )}
      >
        <span className="text-sm">{parts?.weekday}</span>
        <span className="font-heading text-[1.75rem] font-medium leading-none">{parts?.day}</span>
        <span className="text-sm">{parts?.month}</span>
        {parts?.year && <span className="text-xs">{parts.year}</span>}
      </time>
      <div className="min-w-0 self-center">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className={cn(
              "min-w-0 basis-full text-[1.0625rem] font-semibold leading-snug [overflow-wrap:anywhere] sm:basis-auto",
              c.status === "cancelled" && "text-muted-foreground line-through",
            )}
          >
            {c.reason}
          </h2>
          <StatusBadge status={c.status} />
        </div>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          <time dateTime={c.scheduledAt} className="font-medium text-foreground">
            {parts ? `${parts.time}${mounted ? "" : " UTC"}` : "Invalid date"}
          </time>{" "}
          for {name}
        </p>
      </div>
      {/* A cancelled consultation can never change again, so it gets no controls at all. */}
      {c.status !== "cancelled" && (
        <div
          className={cn(
            "col-span-2 flex flex-wrap items-center gap-2",
            "sm:col-span-1 sm:col-start-2",
            "lg:col-start-3 lg:row-start-1 lg:self-center",
          )}
        >
          <Label
            htmlFor={`done-${c.id}`}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-2.5",
              "text-[0.9375rem] font-medium leading-normal",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 md:min-h-9",
            )}
          >
            <Checkbox
              id={`done-${c.id}`}
              aria-label={`Mark as done: ${c.reason}`}
              checked={c.status === "completed"}
              disabled={pending}
              onCheckedChange={(v) => runOnRow({ action: v === true ? "complete" : "incomplete" })}
            />
            Mark as done
          </Label>
          {/* Reschedule and Cancel only work on a scheduled consultation, so other rows do not show them. */}
          {scheduled && (
            <>
              <Dialog
                open={rescheduleOpen}
                onOpenChange={(o) => {
                  setRescheduleOpen(o);
                  if (o) {
                    setWhen(isoToLocalInput(c.scheduledAt));
                    setRescheduleError(null);
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={pending}>
                    Reschedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form noValidate onSubmit={reschedule} className="grid gap-4">
                    <DialogHeader>
                      <DialogTitle>Pick a new time</DialogTitle>
                      <DialogDescription>
                        For “{c.reason}”. Times are in your own timezone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2">
                      <Label htmlFor={`when-${c.id}`}>New date and time</Label>
                      <Input
                        id={`when-${c.id}`}
                        type="datetime-local"
                        value={when}
                        aria-invalid={!!rescheduleError}
                        aria-describedby={`when-${c.id}-error`}
                        onChange={(e) => setWhen(e.target.value)}
                      />
                      <p
                        id={`when-${c.id}-error`}
                        role="alert"
                        className="min-h-5 text-sm text-destructive"
                      >
                        {rescheduleError}
                      </p>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          Keep current time
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={pending}>
                        {pending ? "Saving…" : "Save new time"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this consultation?</AlertDialogTitle>
                    <AlertDialogDescription>
                      “{c.reason}” will be cancelled. You can’t undo this, but you can book a new
                      time whenever you like.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction
                      className={buttonVariants({ variant: "destructive" })}
                      onClick={async () => {
                        const err = await run({ action: "cancel" });
                        setError(err);
                        if (!err) setCancelledHere(true);
                      }}
                    >
                      Yes, cancel it
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
      <p role="status" className="sr-only">
        {cancelledHere && c.status === "cancelled"
          ? "Cancelled. It stays here for your records."
          : ""}
      </p>
      <p
        role="alert"
        className="col-span-2 text-sm text-destructive empty:hidden sm:col-span-1 sm:col-start-2 lg:col-span-2"
      >
        {error}
      </p>
    </li>
  );
}
