import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-semibold",
  {
    variants: {
      variant: {
        // One variant per consultation status.
        scheduled: "border-transparent bg-accent text-accent-foreground",
        completed: "border-transparent bg-success text-success-foreground",
        cancelled: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "scheduled",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
