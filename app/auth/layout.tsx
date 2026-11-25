import { cn } from "@/lib/utils";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mx-auto grid min-h-svh w-full max-w-5xl content-start gap-8 px-4 py-10",
        "md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:content-center md:gap-16 md:px-6",
      )}
    >
      <div>
        <p className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Mini-LMS</p>
        <p className="mt-2 max-w-sm text-muted-foreground md:mt-4 md:text-lg">
          Book a consultation, move it when plans change, and see what&rsquo;s coming up.
        </p>
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}
