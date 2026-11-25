import type { Metadata } from "next";
import { BookingForm } from "@/components/consultations/booking-form";

export const metadata: Metadata = { title: "Book a consultation" };

export default function BookPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-[2rem] font-medium leading-tight tracking-tight md:text-[2.5rem]">
          Book a consultation
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Tell us who it&rsquo;s for, what you&rsquo;d like to cover and when suits you.
        </p>
      </div>
      <BookingForm />
    </div>
  );
}
