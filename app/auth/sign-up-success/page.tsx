import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Confirmation may be on or off depending on the project; the link works either way
// (it lands on login without a session).
export default function Page() {
  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-[1.75rem] font-medium leading-tight">
          Thanks for signing up
        </h1>
      </CardHeader>
      <CardContent className="grid gap-3 text-muted-foreground">
        <p>Check your inbox for a confirmation link, then log in.</p>
        <p>
          Already signed in?{" "}
          <Link href="/" className="text-primary underline underline-offset-4">
            Go to your consultations
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
