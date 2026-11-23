"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import type { Row } from "@/data/types";

const responseSchema = z.object({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
});

type RowsState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: Row[] };

export function useRows(reportId: string): { state: RowsState; retry: () => void } {
  const [state, setState] = useState<RowsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/reports/${encodeURIComponent(reportId)}/rows`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`rows request failed: ${response.status}`);
        return response.json();
      })
      .then((body: unknown) => setState({ status: "ready", rows: responseSchema.parse(body).rows }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [reportId, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
