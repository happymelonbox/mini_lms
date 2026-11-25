import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";
import { auth, router } from "@/tests/navigation";
import { LogoutButton } from "./logout-button";

beforeEach(() => {
  auth.signOut.mockResolvedValue({ error: null });
});

it.each([{ name: "signs out locally, goes to login and refreshes" }])(
  "LogoutButton $name",
  async () => {
    render(<LogoutButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Log out" }));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(router.replace).toHaveBeenCalledWith("/auth/login");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  },
);
