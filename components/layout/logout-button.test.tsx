import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { LogoutButton } from "./logout-button";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  signOut: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut: mocks.signOut } }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOut.mockResolvedValue({ error: null });
});

it.each([{ name: "signs out locally, goes to login and refreshes" }])(
  "LogoutButton $name",
  async () => {
    render(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Log out" }));
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.router.replace).toHaveBeenCalledWith("/auth/login");
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  },
);
