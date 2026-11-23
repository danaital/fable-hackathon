import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/rates/route";
import { clearRateCache } from "./upstream";

const BASE_URL = "https://rates.test/v1";
const NOW = new Date("2026-03-04T12:00:00Z");
const call = (query: string) => GET(new Request(`http://localhost/api/rates?${query}`));

const series = {
  amount: 1,
  base: "USD",
  start_date: "2026-02-27",
  end_date: "2026-03-03",
  rates: { "2026-02-27": { EUR: 0.8471 }, "2026-03-02": { EUR: 0.85485 }, "2026-03-03": { EUR: 0.86162 } },
};
const single = (date: string, rate: number) => ({ amount: 1, base: "USD", date, rates: { EUR: rate } });

let fetchMock: ReturnType<typeof vi.fn>;
const answer = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(Response.json(body, { status }));

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("FRANKFURTER_URL", BASE_URL);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  clearRateCache();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/rates configuration", () => {
  it("fails fast with 503 when FRANKFURTER_URL is missing", async () => {
    vi.stubEnv("FRANKFURTER_URL", "");
    const response = await call("base=USD&symbols=EUR&date=2026-03-02");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "rates_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/rates validation", () => {
  it.each([
    ["missing base", "symbols=EUR"],
    ["lowercase base", "base=usd&symbols=EUR"],
    ["base outside the allow-list", "base=XYZ&symbols=EUR"],
    ["symbol outside the allow-list", "base=USD&symbols=EUR,ABC"],
    ["base among symbols", "base=USD&symbols=USD"],
    ["malformed date", "base=USD&symbols=EUR&date=03/02/2026"],
    ["impossible date", "base=USD&symbols=EUR&date=2026-02-30"],
    ["future date", "base=USD&symbols=EUR&date=2026-03-05"],
    ["date before 1999-01-04", "base=USD&symbols=EUR&date=1999-01-03"],
    ["too many dates", `base=USD&symbols=EUR&date=${Array.from({ length: 101 }, () => "2026-03-02").join(",")}`],
  ])("rejects %s with 400", async (_name, query) => {
    const response = await call(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_query" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/rates batching and caching", () => {
  it("answers several dates with one time-series call, weekends taking the previous business day", async () => {
    answer(series);
    const response = await call("base=USD&symbols=EUR&date=2026-03-02,2026-03-01,2026-03-03");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE_URL}/2026-03-01..2026-03-03?base=USD&symbols=EUR`);
    expect(await response.json()).toEqual({
      base: "USD",
      rates: {
        "2026-03-01": { date: "2026-02-27", rates: { EUR: 0.8471 } },
        "2026-03-02": { date: "2026-03-02", rates: { EUR: 0.85485 } },
        "2026-03-03": { date: "2026-03-03", rates: { EUR: 0.86162 } },
      },
    });
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });

  it("asks for a single day when the series has nothing on or before it", async () => {
    answer({ ...series, rates: { "2026-03-02": { EUR: 0.85485 } } });
    answer(single("2026-02-27", 0.8471));
    const body = await (await call("base=USD&symbols=EUR&date=2026-02-28,2026-03-02")).json();
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${BASE_URL}/2026-02-28?base=USD&symbols=EUR`);
    expect(body.rates["2026-02-28"]).toEqual({ date: "2026-02-27", rates: { EUR: 0.8471 } });
  });

  it("serves historical dates from memory the second time", async () => {
    answer(series);
    await call("base=USD&symbols=EUR&date=2026-03-02");
    const response = await call("base=USD&symbols=EUR&date=2026-03-02");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives latest a short cache", async () => {
    answer(single("2026-03-04", 0.9));
    const response = await call("base=USD&symbols=EUR");
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${BASE_URL}/latest?base=USD&symbols=EUR`);
    expect((await response.json()).rates.latest).toEqual({ date: "2026-03-04", rates: { EUR: 0.9 } });
    expect(response.headers.get("Cache-Control")).not.toContain("immutable");
  });
});

describe("GET /api/rates upstream failures", () => {
  it("maps an upstream error to 502 without leaking its body", async () => {
    answer({ message: "secret upstream detail" }, 500);
    const response = await call("base=USD&symbols=EUR&date=2026-03-02");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "rates_upstream_failed" });
  });

  it("rejects an upstream answer with the wrong shape", async () => {
    answer({ ...series, rates: { "2026-03-02": { EUR: "lots" } } });
    expect((await call("base=USD&symbols=EUR&date=2026-03-02")).status).toBe(502);
  });

  it("rejects an upstream answer for another base", async () => {
    answer(single("2026-03-04", 0.9));
    fetchMock.mockReset();
    answer({ ...single("2026-03-04", 0.9), base: "EUR" });
    expect((await call("base=USD&symbols=EUR&date=latest")).status).toBe(502);
  });

  it("maps a network failure or timeout to 502", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect((await call("base=USD&symbols=EUR&date=2026-03-02")).status).toBe(502);
  });
});
