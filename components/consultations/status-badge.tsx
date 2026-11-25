import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConsultationDto } from "@/lib/consultations/service";

// The tick tells completed from scheduled without relying on the two close tints.
export function StatusBadge({ status }: { status: ConsultationDto["status"] }) {
  return (
    <Badge variant={status} className="capitalize">
      {status === "completed" && <Check aria-hidden className="mr-1 size-3.5" />}
      {status}
    </Badge>
  );
}
