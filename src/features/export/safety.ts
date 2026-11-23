// Everything that makes user-controlled text safe to put in a file name, a sheet name or a spreadsheet cell.

const FILE_NAME_MAX = 120;
const SHEET_NAME_MAX = 31;
const FORMULA_PREFIX = "'";
// A spreadsheet treats a cell starting with one of these (also after leading blanks) as a formula or a DDE call.
const FORMULA_TRIGGER = /^\s*[=+\-@]|^[\t\r\n]/;
// Path separators and the characters Windows refuses in a file name.
const FILE_ILLEGAL = /[\\/:*?"<>|]/g;
// Control characters, plus the bidirectional overrides that can disguise a file extension.
const CONTROL = /[\p{Cc}‎‏‪-‮⁦-⁩]/gu;
const SHEET_ILLEGAL = /[\\/?*[\]:]/g;

/** Text that could run as a formula gets a leading apostrophe, so spreadsheets show it as plain text. */
export function neutralizeFormula(text: string): string {
  return FORMULA_TRIGGER.test(text) ? `${FORMULA_PREFIX}${text}` : text;
}

/** A safe file name without extension. Empty when nothing usable is left. */
export function sanitizeFileName(input: string): string {
  return input
    .replace(CONTROL, "")
    .replace(FILE_ILLEGAL, "-")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "")
    .slice(0, FILE_NAME_MAX)
    .replace(/[-. ]+$/, "");
}

interface DefaultNameInput {
  title: string;
  filtered: boolean;
  custom: boolean;
  now: Date;
}

/** `<title>[-filtered][-custom]-<time to the second>`. Hebrew titles are kept. */
export function defaultFileName({ title, filtered, custom, now }: DefaultNameInput): string {
  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-");
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return sanitizeFileName([slug, filtered ? "filtered" : "", custom ? "custom" : "", stamp].filter(Boolean).join("-"));
}

/** Excel sheet name: no illegal characters, at most 31 characters, unique in the workbook (case-insensitive). */
export function uniqueSheetName(raw: string, taken: Set<string>, fallback: string): string {
  const clean = (text: string) =>
    text.replace(CONTROL, "").replace(SHEET_ILLEGAL, "_").replace(/^'+|'+$/g, "").trim().slice(0, SHEET_NAME_MAX).trim();
  const base = clean(raw) || clean(fallback);
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n += 1) {
    const suffix = ` (${n})`;
    name = `${base.slice(0, SHEET_NAME_MAX - suffix.length).trim()}${suffix}`;
  }
  taken.add(name.toLowerCase());
  return name;
}

/** Repeated headers stay separate columns: the repeat becomes "Header (2)", skipping numbers already taken. */
export function uniqueHeaders(headers: readonly string[]): string[] {
  const taken = new Set<string>();
  return headers.map((header) => {
    let name = header;
    for (let n = 2; taken.has(name); n += 1) name = `${header} (${n})`;
    taken.add(name);
    return name;
  });
}
