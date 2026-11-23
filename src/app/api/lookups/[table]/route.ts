import { z } from "zod";
import { dataJson, hasNoQuery, withDataSource } from "@/lib/db/http";
import { getLookup } from "@/lib/db/source";

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;

const paramsSchema = z.object({ table: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/) });

// shortcut: no auth check yet because the data is synthetic and login is not built.
// Add the session check here when auth lands.
export async function GET(request: Request, context: { params: Promise<{ table: string }> }) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return dataJson({ error: "invalid_lookup_table" }, HTTP_BAD_REQUEST);
  if (!hasNoQuery(request)) return dataJson({ error: "invalid_query" }, HTTP_BAD_REQUEST);

  return withDataSource(async (queries) => {
    const items = await getLookup(parsed.data.table, queries);
    return items ? dataJson({ items }) : dataJson({ error: "lookup_not_found" }, HTTP_NOT_FOUND);
  });
}
