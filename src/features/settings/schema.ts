import { z } from "zod";

/**
 * Settings shapes shared by the settings screens, the formatters and currency conversion.
 * Three layers, highest first: per-report override → user settings → defaults.
 * In a per-report override every member is optional, and "absent" means "inherit".
 */

export const DATE_FORMATS = ["DD.MM.YY", "DD.MM.YYYY", "YY.MM.DD", "YYYY.MM.DD", "DD MMM YYYY", "MMM DD, YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
/** Month-name formats ignore the delimiter. */
export const MONTH_NAME_DATE_FORMATS: readonly DateFormat[] = ["DD MMM YYYY", "MMM DD, YYYY"];

export const DATE_DELIMITERS = [".", "/", "-"] as const;
export type DateDelimiter = (typeof DATE_DELIMITERS)[number];

export const TIME_FORMATS = ["HH:mm", "h:mm A", "hh:mm A"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const DATETIME_STRUCTURES = ["date_time_space", "date_time_comma", "time_date_space", "time_date_comma"] as const;
export type DatetimeStructure = (typeof DATETIME_STRUCTURES)[number];

export const MAX_DECIMAL_DIGITS = 10;
const digits = z.number().int().min(0).max(MAX_DECIMAL_DIGITS);

export const formattingSchema = z.object({
  dateFormat: z.enum(DATE_FORMATS),
  dateDelimiter: z.enum(DATE_DELIMITERS),
  timeFormat: z.enum(TIME_FORMATS),
  datetimeStructure: z.enum(DATETIME_STRUCTURES),
  maxDigitsForNumbers: digits,
  maxDigitsForCurrency: digits,
  maxDigitsForPercent: digits,
});
export type FormattingSettings = z.infer<typeof formattingSchema>;

/** ISO codes amounts can be shown in. */
export const DISPLAY_CURRENCIES = ["ILS", "USD", "EUR", "GBP"] as const;
/** "row" shows every row in its own currency: no conversion. */
export const SOURCE_CURRENCY = "row";
export const CURRENCY_CHOICES = [SOURCE_CURRENCY, ...DISPLAY_CURRENCIES] as const;
export type CurrencyChoice = (typeof CURRENCY_CHOICES)[number];

/** Which day's exchange rate to use: a moving time period, each row's own date field, or one fixed date. */
export const RATE_TIMINGS = ["timePeriod", "dateField", "custom"] as const;
export type RateTiming = (typeof RATE_TIMINGS)[number];

export const RATE_TIME_PERIODS = ["yesterday", "today", "lastTradeDay", "nextTradeDay", "thisDayLastWeek", "custom"] as const;
export type RateTimePeriod = (typeof RATE_TIME_PERIODS)[number];

/**
 * How a money cell shows a conversion (spec field modes, made a setting):
 * static = never convert, each row in its own currency; dynamic = convert at the rate timing;
 * staticConverted = convert every row at one pinned date; semiConverted = dynamic plus the original beside it.
 */
export const CURRENCY_DISPLAY_MODES = ["dynamic", "semiConverted", "staticConverted", "static"] as const;
export type CurrencyDisplayMode = (typeof CURRENCY_DISPLAY_MODES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const currencySchema = z.object({
  selectedCurrency: z.enum(CURRENCY_CHOICES),
  displayMode: z.enum(CURRENCY_DISPLAY_MODES),
  exchangeRateTiming: z.enum(RATE_TIMINGS),
  currencyTimePeriod: z.enum(RATE_TIME_PERIODS),
  /** ISO day (YYYY-MM-DD), used when timing or period is "custom". */
  customExchangeDate: isoDate.nullable(),
  /** Row field holding the date to convert at, when timing is "dateField". Only meaningful per report. */
  dateFieldForConversion: z.string().nullable(),
});
export type CurrencySettings = z.infer<typeof currencySchema>;

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const SUMMARY_ROW_LOCATIONS = ["top", "bottom", "both", "none"] as const;
export type SummaryRowLocation = (typeof SUMMARY_ROW_LOCATIONS)[number];

export const MIN_SEARCH_RANGE = { min: 1, max: 10 } as const;

export const customizationSchema = z.object({
  toolbarCollapsed: z.boolean(),
  minSearch: z.number().int().min(MIN_SEARCH_RANGE.min).max(MIN_SEARCH_RANGE.max),
  summaryRowLocation: z.enum(SUMMARY_ROW_LOCATIONS),
  isTableHeaderPinned: z.boolean(),
});
export type CustomizationSettings = z.infer<typeof customizationSchema>;

export const DEFAULT_FORMATTING: FormattingSettings = {
  dateFormat: "DD.MM.YYYY",
  dateDelimiter: ".",
  timeFormat: "HH:mm",
  datetimeStructure: "date_time_space",
  maxDigitsForNumbers: 2,
  maxDigitsForCurrency: 2,
  maxDigitsForPercent: 2,
};

export const DEFAULT_CURRENCY: CurrencySettings = {
  selectedCurrency: SOURCE_CURRENCY,
  displayMode: "dynamic",
  exchangeRateTiming: "timePeriod",
  currencyTimePeriod: "today",
  customExchangeDate: null,
  dateFieldForConversion: null,
};

export const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  toolbarCollapsed: true,
  minSearch: 2,
  summaryRowLocation: "bottom",
  isTableHeaderPinned: true,
};

/** One document per user. Stored values are untrusted: anything invalid falls back to the defaults. */
export const userSettingsSchema = z.object({
  formatting: formattingSchema.default(DEFAULT_FORMATTING),
  currency: currencySchema.default(DEFAULT_CURRENCY),
  customization: customizationSchema.default(DEFAULT_CUSTOMIZATION),
  themeMode: z.enum(THEME_CHOICES).default("system"),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  formatting: DEFAULT_FORMATTING,
  currency: DEFAULT_CURRENCY,
  customization: DEFAULT_CUSTOMIZATION,
  themeMode: "system",
};

/** One document per user per report. Absent members inherit from the user settings. */
export const reportSettingsSchema = z.object({
  formatting: formattingSchema.partial().optional(),
  currency: currencySchema.partial().optional(),
  customization: customizationSchema.partial().optional(),
});
export type ReportSettings = z.infer<typeof reportSettingsSchema>;

export const reportSettingsMapSchema = z.record(z.string(), reportSettingsSchema);
export type ReportSettingsMap = z.infer<typeof reportSettingsMapSchema>;

/** The flat result a report renders with. */
export interface EffectiveSettings {
  formatting: FormattingSettings;
  currency: CurrencySettings;
  customization: CustomizationSettings;
}

function inherit<T extends object>(base: T, override: Partial<T> | undefined): T {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override) as (keyof T)[]) {
    const value = override[key];
    // undefined means "inherit"; false, 0 and null are real choices.
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Resolves each member on its own: report override first, then the user's value. */
export function resolveEffective(user: UserSettings, report?: ReportSettings): EffectiveSettings {
  return {
    formatting: inherit(user.formatting, report?.formatting),
    currency: inherit(user.currency, report?.currency),
    customization: inherit(user.customization, report?.customization),
  };
}
