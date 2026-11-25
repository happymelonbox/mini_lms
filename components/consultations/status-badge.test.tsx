import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ConsultationDto } from "@/lib/consultations/service";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each<{ status: ConsultationDto["status"] }>([
    { status: "scheduled" },
    { status: "completed" },
    { status: "cancelled" },
  ])("$status shows its status as text", ({ status }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeVisible();
  });
});
