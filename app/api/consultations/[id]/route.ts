import { authenticate } from "@/lib/api/auth";
import { checkMutationHeaders, parseJsonBody } from "@/lib/api/guards";
import { dbErrorResponse, errorResponse, json } from "@/lib/api/respond";
import { idSchema, patchSchema } from "@/lib/consultations/schema";
import { updateConsultation } from "@/lib/consultations/service";

const notFound = () => errorResponse(404, "not_found", "Not found");

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authenticate("student");
  if ("response" in auth) return auth.response;
  const bad = checkMutationHeaders(req);
  if (bad) return bad;
  // Non-UUID ids look exactly like unknown ones: no enumeration hints.
  const id = idSchema.safeParse((await ctx.params).id);
  if (!id.success) return notFound();
  const body = await parseJsonBody(req, patchSchema);
  if ("response" in body) return body.response;

  const result = await updateConsultation(auth.supabase, auth.user.id, id.data, body.data);
  if (!result.ok) return dbErrorResponse(result.error);
  return result.value ? json(result.value) : notFound();
}
