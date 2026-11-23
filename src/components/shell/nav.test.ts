import { describe, expect, it } from "vitest";
import { isNavActive } from "./nav";

describe("isNavActive", () => {
  it("matches the route itself and its child routes", () => {
    expect(isNavActive("/views", "/views")).toBe(true);
    expect(isNavActive("/views/orders", "/views")).toBe(true);
  });

  it("does not match a sibling route that shares a prefix", () => {
    expect(isNavActive("/viewsx", "/views")).toBe(false);
  });

  it("matches home only on home", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/settings", "/")).toBe(false);
  });
});
