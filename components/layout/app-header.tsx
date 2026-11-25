"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import type { Role } from "@/lib/auth/current-user";
import { cn } from "@/lib/utils";

const NAV = {
  student: [
    { href: "/dashboard", label: "Consultations" },
    { href: "/dashboard/book", label: "Book" },
  ],
  admin: [{ href: "/admin", label: "All consultations" }],
};

export function AppHeader({ role, email }: { role: Role; email: string | undefined }) {
  const pathname = usePathname();
  return (
    <header className="border-b bg-card">
      {/* One nav for every width: on phones it drops to a full-width row of tabs under the wordmark.
          A role with a single page gets no nav, since the tab would only repeat the page heading. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 px-4 md:px-6">
        <Link href="/" className="py-3 font-heading text-xl font-semibold tracking-tight">
          Mini-LMS
        </Link>
        {NAV[role].length > 1 && (
          <nav
            aria-label="Main"
            className="order-last -mx-4 w-[calc(100%+2rem)] border-t md:order-none md:mx-0 md:w-auto md:border-0"
          >
            <ul className="flex">
              {NAV[role].map((n) => {
                const current = pathname === n.href;
                return (
                  <li key={n.href} className="flex-1 md:flex-none">
                    <Link
                      href={n.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center justify-center border-b-2 px-3 text-[0.9375rem]",
                        "font-medium transition-colors md:min-h-16",
                        current
                          ? "border-primary text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <div className="ml-auto flex min-w-0 items-center gap-1 py-2">
          <span
            className="mr-2 hidden min-w-0 truncate text-sm text-muted-foreground lg:block"
            title={email}
          >
            {email}
          </span>
          <ThemeSwitcher />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
