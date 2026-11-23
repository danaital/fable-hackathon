import { describe, expect, it } from "vitest";
import { getAuthMode } from "./mode";

const SUPABASE = { NEXT_PUBLIC_SUPABASE_URL: "https://project.example", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable" };

describe("AUTH_MODE", () => {
  it("defaults to demo", () => {
    expect(getAuthMode({})).toBe("demo");
    expect(getAuthMode({ AUTH_MODE: " DEMO " })).toBe("demo");
  });

  it("rejects unknown modes instead of falling back", () => {
    expect(() => getAuthMode({ AUTH_MODE: "off" })).toThrow(/AUTH_MODE must be one of/);
  });

  it("fails fast, naming the missing variables, when supabase is half configured", () => {
    expect(() => getAuthMode({ AUTH_MODE: "supabase" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(() => getAuthMode({ AUTH_MODE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://project.example" })).toThrow(/needs NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(getAuthMode({ AUTH_MODE: "supabase", ...SUPABASE })).toBe("supabase");
  });
});
