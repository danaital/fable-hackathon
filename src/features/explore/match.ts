import type { ReportDef, Tag } from "@/data/types";

export const TAG_RELATIONS = ["and", "or"] as const;
export type TagRelation = (typeof TAG_RELATIONS)[number];

interface MatchInput {
  reports: readonly ReportDef[];
  /** Lower-cased search text per report id (title, description and tag labels in the current language). */
  searchText: ReadonlyMap<string, string>;
  term: string;
  tags: ReadonlySet<Tag>;
  relation: TagRelation;
}

/** AND: a report must carry every selected tag. OR: any one is enough. No selected tags matches everything. */
export function matchesTags(report: ReportDef, tags: ReadonlySet<Tag>, relation: TagRelation): boolean {
  if (tags.size === 0) return true;
  const has = (tag: Tag) => report.tags.includes(tag);
  return relation === "and" ? [...tags].every(has) : [...tags].some(has);
}

export function matchReports({ reports, searchText, term, tags, relation }: MatchInput): ReportDef[] {
  const needle = term.trim().toLowerCase();
  return reports.filter(
    (report) => matchesTags(report, tags, relation) && (!needle || (searchText.get(report.id) ?? "").includes(needle)),
  );
}

/** Tags that would leave no report if selected now, so the UI can warn before the user picks them. */
export function deadEndTags(input: MatchInput & { candidates: readonly Tag[] }): Set<Tag> {
  const { candidates, tags, ...rest } = input;
  return new Set(
    candidates.filter((tag) => !tags.has(tag) && matchReports({ ...rest, tags: new Set([...tags, tag]) }).length === 0),
  );
}
