import { z } from "zod";
import { dataJson, hasNoQuery, withDataSource } from "@/lib/db/http";
import { getReportRows } from "@/lib/db/source";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

const paramsSchema = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,40}$/) });

// shortcut: no auth check yet because the data is synthetic and login is not built.
// Add the session and per-report role check here when auth lands.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return dataJson({ error: "invalid_report_id" }, HTTP_BAD_REQUEST);
  if (!hasNoQuery(request)) return dataJson({ error: "invalid_query" }, HTTP_BAD_REQUEST);

  return withDataSource(async (queries) => {
    const body = await getReportRows(parsed.data.id, queries);
    return body ? dataJson(body) : dataJson({ error: "report_not_found" }, HTTP_NOT_FOUND);
  });
}
