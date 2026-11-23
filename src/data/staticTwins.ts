import type { I18nKey } from "@/i18n/en";
import type { FieldDef, Row } from "./types";

/**
 * Every money field that can be converted (dynamic) gets a static twin right after it:
 * the same amount, always in the row's own currency, never converted.
 */
const STATIC_SUFFIX = "Static";
const STATIC_CURRENCY_SUFFIX = "StaticCurrency";

// Twin labels are spelled out so they stay typed translation keys. A money field without an entry gets no twin.
const STATIC_LABEL: Partial<Record<I18nKey, I18nKey>> = {
  "field.amount": "field.amount.static",
  "field.lifetimeValue": "field.lifetimeValue.static",
  "field.net": "field.net.static",
  "field.total": "field.total.static",
  "field.shippingCost": "field.shippingCost.static",
  "field.unitCost": "field.unitCost.static",
  "field.price": "field.price.static",
};

const isDynamicMoney = (field: FieldDef) => field.type === "currency" && Boolean(field.currencyKey) && !field.static;

export function withStaticTwins(fields: readonly FieldDef[]): FieldDef[] {
  return fields.flatMap((field) => {
    const labelKey = STATIC_LABEL[field.labelKey];
    const twinKey = `${field.key}${STATIC_SUFFIX}`;
    // Already has its twin (the list was processed before): leave it alone.
    if (!isDynamicMoney(field) || !labelKey || fields.some((other) => other.key === twinKey)) return [field];
    const twin: FieldDef = {
      key: twinKey,
      type: "currency",
      labelKey,
      currencyKey: `${field.key}${STATIC_CURRENCY_SUFFIX}`,
      static: true,
    };
    return [field, twin];
  });
}

/** Copies each dynamic money value and its currency code into the twin's columns, before any conversion runs. */
export function addStaticValues(rows: readonly Row[], fields: readonly FieldDef[]): readonly Row[] {
  const twins = fields.filter((field) => field.static && field.currencyKey && field.key.endsWith(STATIC_SUFFIX));
  if (twins.length === 0) return rows;
  const sources = twins.flatMap((twin) => {
    const source = fields.find((field) => field.key === twin.key.slice(0, -STATIC_SUFFIX.length));
    return source?.currencyKey && twin.currencyKey ? [{ twin, source, code: source.currencyKey, twinCode: twin.currencyKey }] : [];
  });
  return rows.map((row) => {
    const next: Row = { ...row };
    for (const { twin, source, code, twinCode } of sources) {
      next[twin.key] = row[source.key] ?? null;
      next[twinCode] = row[code] ?? null;
    }
    return next;
  });
}
