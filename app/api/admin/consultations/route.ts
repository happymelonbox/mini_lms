import { authenticate } from "@/lib/api/auth";
import { parsePageQuery } from "@/lib/api/guards";
import { dbErrorResponse, json } from "@/lib/api/respond";
import { listAllConsultations } from "@/lib/consultations/service";

export async function GET(req: Request) {
  const auth = await authenticate("admin");
  if ("response" in auth) return auth.response;
  const q = parsePageQuery(req);
  if ("response" in q) return q.response;

  const result = await listAllConsultations(auth.supabase, q.query);
  if (!result.ok) return dbErrorResponse(result.error);
  return json({ ...result.value, pageSize: q.query.pageSize });
}
