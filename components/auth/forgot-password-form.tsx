"use client";

// Form that asks Supabase to email a password-reset link.

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "That didn’t work. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return success ? (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-[1.75rem] font-medium leading-tight">Check your inbox</h1>
        <CardDescription>A reset link is on its way.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          If an account uses that email, you&rsquo;ll get a link to set a new password. It can take
          a minute to arrive.
        </p>
      </CardContent>
    </Card>
  ) : (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-[1.75rem] font-medium leading-tight">
          Reset your password
        </h1>
        <CardDescription>
          Enter your email and we&rsquo;ll send you a link to set a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleForgotPassword}>
          <div className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending…" : "Send reset link"}
            </Button>
          </div>
          <div className="mt-5 text-sm">
            Remembered it?{" "}
            <Link href="/auth/login" className="text-primary underline underline-offset-4">
              Log in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
