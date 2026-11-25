import { authenticate } from "@/lib/api/auth";
import { checkMutationHeaders, parseJsonBody, parsePageQuery } from "@/lib/api/guards";
import { dbErrorResponse, json } from "@/lib/api/respond";
import { createSchema } from "@/lib/consultations/schema";
import { createConsultation, listOwnConsultations } from "@/lib/consultations/service";

export async function GET(req: Request) {
  const auth = await authenticate("student");
  if ("response" in auth) return auth.response;
  const q = parsePageQuery(req);
  if ("response" in q) return q.response;

  const result = await listOwnConsultations(auth.supabase, auth.user.id, q.query);
  if (!result.ok) return dbErrorResponse(result.error);
  return json({ ...result.value, pageSize: q.query.pageSize });
}

export async function POST(req: Request) {
  const auth = await authenticate("student");
  if ("response" in auth) return auth.response;
  const bad = checkMutationHeaders(req);
  if (bad) return bad;
  const body = await parseJsonBody(req, createSchema);
  if ("response" in body) return body.response;

  const result = await createConsultation(auth.supabase, auth.user.id, body.data);
  if (!result.ok) return dbErrorResponse(result.error);
  return json(result.value, 201);
}
