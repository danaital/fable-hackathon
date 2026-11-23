import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getQueries } from "./client";
import type { Queries } from "./source";

export const DATA_SOURCE_HEADER = "x-bahir-data-source";

const HTTP_OK = 200;
const HTTP_UNAVAILABLE = 503;

// The data routes take no query parameters, so any parameter is a caller mistake.
const noQuerySchema = z.strictObject({});

export const hasNoQuery = (request: Request): boolean =>
  noQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams)).success;

/** A JSON response that names where its data came from. */
export function dataJson(body: object, status: number = HTTP_OK): NextResponse {
  return NextResponse.json(body, { status, headers: { [DATA_SOURCE_HEADER]: getQueries() ? "postgres" : "generator" } });
}

/** Runs a read. A failing database answers 503; it never falls back to generated data. */
export async function withDataSource(load: (queries: Queries | null) => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await load(getQueries());
  } catch (error) {
    // Name and code only: driver messages can carry the host and user of the connection string.
    const name = error instanceof Error ? error.name : "unknown";
    const code = error instanceof Error && "code" in error ? String(error.code) : "none";
    logger.error("db: read failed", { name, code });
    return dataJson({ error: "data_source_unavailable" }, HTTP_UNAVAILABLE);
  }
}
