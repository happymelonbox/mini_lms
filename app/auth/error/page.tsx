import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const MESSAGES: Record<string, string> = {
  no_role: "Your account isn’t set up yet. Ask an admin to give you access.",
  missing_token: "That link is missing a piece. Ask for a new one and try again.",
  invalid_link: "That link has expired or was already used. Ask for a new one and try again.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Own-property lookup only, so the query string can never pick anything but our fixed copy.
  const message =
    error && Object.hasOwn(MESSAGES, error)
      ? MESSAGES[error]
      : "Something unexpected happened. Please try again.";
  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-[1.75rem] font-medium leading-tight">
          Something went wrong
        </h1>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground">{message}</p>
        <Link href="/auth/login" className="w-fit py-2 text-primary underline underline-offset-4">
          Back to log in
        </Link>
      </CardContent>
    </Card>
  );
}
