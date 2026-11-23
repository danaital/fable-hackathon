import { describe, expect, it } from "vitest";
import type { ReportDef, Tag } from "@/data/types";
import { deadEndTags, matchReports } from "./match";

const report = (id: string, tags: Tag[]): ReportDef => ({
  id,
  titleKey: "report.orders.title",
  descKey: "report.orders.desc",
  icon: "orders",
  tags,
  fields: [],
});

const reports = [report("a", ["sales", "finance"]), report("b", ["sales"]), report("c", ["support"])];
const searchText = new Map([
  ["a", "orders money"],
  ["b", "customers"],
  ["c", "tickets help"],
]);
const ids = (list: ReportDef[]) => list.map((r) => r.id);

describe("matchReports", () => {
  it("returns everything with no tags and no search", () => {
    expect(ids(matchReports({ reports, searchText, term: "", tags: new Set(), relation: "and" }))).toEqual(["a", "b", "c"]);
  });

  it("AND needs every selected tag, OR needs any", () => {
    const tags = new Set<Tag>(["sales", "finance"]);
    expect(ids(matchReports({ reports, searchText, term: "", tags, relation: "and" }))).toEqual(["a"]);
    expect(ids(matchReports({ reports, searchText, term: "", tags, relation: "or" }))).toEqual(["a", "b"]);
  });

  it("combines tags with the search term", () => {
    const tags = new Set<Tag>(["sales"]);
    expect(ids(matchReports({ reports, searchText, term: " CUSTOM ", tags, relation: "or" }))).toEqual(["b"]);
  });
});

describe("deadEndTags", () => {
  it("flags tags that would leave no report", () => {
    const base = { reports, searchText, term: "", candidates: ["sales", "finance", "support", "inventory"] as Tag[] };
    expect([...deadEndTags({ ...base, tags: new Set<Tag>(["sales"]), relation: "and" })].sort()).toEqual(["inventory", "support"]);
    // With OR, adding a tag can only widen the result, so nothing is a dead end while something matches.
    expect([...deadEndTags({ ...base, tags: new Set<Tag>(["sales"]), relation: "or" })]).toEqual([]);
  });
});
