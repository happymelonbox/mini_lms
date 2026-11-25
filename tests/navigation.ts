import type { SupabaseClient } from "@supabase/supabase-js";
import type { useRouter } from "next/navigation";
import { vi } from "vitest";

type Router = ReturnType<typeof useRouter>;

export const router = {
  push: vi.fn<Router["push"]>(),
  replace: vi.fn<Router["replace"]>(),
  refresh: vi.fn<Router["refresh"]>(),
  back: vi.fn<Router["back"]>(),
};
// Mutable so a test can set the current path before rendering.
export const nav = { pathname: "/" };
// Real parameters, narrow result: the components read only { error }, so tests need no full AuthResponse.
type Auth = SupabaseClient["auth"];
type Method = "signInWithPassword" | "signUp" | "updateUser" | "resetPasswordForEmail" | "signOut";
type Spy<K extends Method> = (...args: Parameters<Auth[K]>) => Promise<{ error: Error | null }>;
export const auth = {
  signInWithPassword: vi.fn<Spy<"signInWithPassword">>(),
  signUp: vi.fn<Spy<"signUp">>(),
  updateUser: vi.fn<Spy<"updateUser">>(),
  resetPasswordForEmail: vi.fn<Spy<"resetPasswordForEmail">>(),
  signOut: vi.fn<Spy<"signOut">>(),
};

// Sentinel messages are what tests assert on: rejects.toEqual(new Error("REDIRECT:/")).
export const navigation = {
  useRouter: () => router,
  usePathname: () => nav.pathname,
  redirect: (to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  },
};
