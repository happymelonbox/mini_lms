"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createConsultationRequest } from "@/lib/api/client";
import { bookingFormSchema, friendlyMessage } from "@/lib/consultations/form-schema";

type FormValues = z.input<typeof bookingFormSchema>;
type Parsed = z.output<typeof bookingFormSchema>;

export function BookingForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, Parsed>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { firstName: "", lastName: "", reason: "", scheduledAt: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const res = await createConsultationRequest(values);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    const known = ["firstName", "lastName", "reason", "scheduledAt"] as const;
    let mapped = false;
    for (const k of known) {
      const msg = res.error.fields?.[k]?.[0];
      if (msg) {
        setError(k, { message: msg });
        mapped = true;
      }
    }
    if (!mapped) setFormError(res.error.message);
  });

  const field = (id: keyof FormValues, label: string, control: React.ReactNode, hint?: string) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {control}
      <p id={`${id}-error`} role="alert" className="text-sm text-destructive empty:hidden">
        {friendlyMessage(id, errors[id]?.message)}
      </p>
    </div>
  );
  const a11y = (id: keyof FormValues, hint = false) => ({
    id,
    "aria-invalid": !!errors[id],
    "aria-describedby": hint ? `${id}-hint ${id}-error` : `${id}-error`,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid max-w-xl gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {field(
          "firstName",
          "First name",
          <Input {...a11y("firstName")} autoComplete="given-name" {...register("firstName")} />,
        )}
        {field(
          "lastName",
          "Last name",
          <Input {...a11y("lastName")} autoComplete="family-name" {...register("lastName")} />,
        )}
      </div>
      {field(
        "reason",
        "What would you like to talk about?",
        <Textarea {...a11y("reason", true)} rows={4} {...register("reason")} />,
        "A sentence or two is plenty.",
      )}
      {field(
        "scheduledAt",
        "Date and time",
        // No min attr: it would depend on the render-time clock/timezone (hydration mismatch);
        // the schema enforces "future".
        <Input
          {...a11y("scheduledAt", true)}
          type="datetime-local"
          className="sm:max-w-xs"
          {...register("scheduledAt")}
        />,
        "In your own timezone. Any time from now on works.",
      )}
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive"
        >
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-fit">
        {isSubmitting ? "Booking…" : "Book it"}
      </Button>
    </form>
  );
}
