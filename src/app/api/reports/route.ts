import { dataJson, hasNoQuery, withDataSource } from "@/lib/db/http";
import { getCatalogue } from "@/lib/db/source";

const HTTP_BAD_REQUEST = 400;

// shortcut: no auth check yet because the data is synthetic and login is not built.
// Add the session check and per-role report filtering here when auth lands.
export async function GET(request: Request) {
  if (!hasNoQuery(request)) return dataJson({ error: "invalid_query" }, HTTP_BAD_REQUEST);
  return withDataSource(async (queries) => dataJson({ reports: await getCatalogue(queries) }));
}
