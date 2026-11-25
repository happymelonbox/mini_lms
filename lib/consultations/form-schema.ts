import { z } from "zod";
import { localInputToIso } from "@/lib/datetime";
import { createSchema, type CreateInput } from "./schema";

// The form holds the raw datetime-local string; it is converted to ISO-with-offset and then checked by the
// same scheduledAt rule the API uses, so client and server cannot drift.
export const bookingFormSchema = z.object({
  ...createSchema.shape,
  scheduledAt: z
    .string()
    .min(1, "Pick a date and time")
    .transform((v, ctx) => {
      const iso = localInputToIso(v);
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Enter a full date and time" });
        return z.NEVER;
      }
      return iso;
    })
    .pipe(createSchema.shape.scheduledAt),
});

// The API keeps its own wording. The booking form and the reschedule dialog show friendlier text for the
// messages people meet most, and pass anything else through unchanged.
const FRIENDLY: Partial<Record<keyof CreateInput, Record<string, string>>> = {
  firstName: { Required: "Add a first name" },
  lastName: { Required: "Add a last name" },
  reason: { Required: "Tell us what you’d like to talk about" },
  scheduledAt: { "Must be in the future": "Pick a time that hasn’t passed yet" },
};

export function friendlyMessage(field: keyof CreateInput, message: string | undefined) {
  const map = FRIENDLY[field];
  // Own-property lookup only, so a message like "constructor" can never pick up an Object prototype member.
  return message && map && Object.hasOwn(map, message) ? map[message] : message;
}
